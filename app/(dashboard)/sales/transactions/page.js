"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
    collection, getDocs, query, orderBy, limit, doc, updateDoc, 
    serverTimestamp, writeBatch, increment, getDoc, deleteDoc 
} from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

// --- IMPORT COMPONENTS ---
import TransactionTable from './components/TransactionTable';
import TransactionCardList from './components/TransactionCardList';

// --- ICONS ---
import { Search, RotateCcw, Filter, Calendar, ChevronDown } from 'lucide-react';

export default function TransactionsHistoryPage() {
    const getTodayString = () => new Date().toISOString().split('T')[0];

    // --- STATE ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterChannel, setFilterChannel] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ from: getTodayString(), to: getTodayString() });
    
    // UI State
    const [expandedId, setExpandedId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // 1. DATA FETCHING (FIXED)
    const fetchOrders = async () => {
        setLoading(true);
        try {
            // FIX: Menggunakan 'order_date' agar sinkron dengan POS & Dashboard
            const q = query(
                collection(db, "sales_orders"), 
                orderBy("order_date", "desc"), 
                limit(500)
            );
            const snap = await getDocs(q);
            
            const list = snap.docs.map(d => {
                const data = d.data();
                // Fallback date handling
                const rawDate = data.order_date || data.order_created_at;
                const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || Date.now());
                
                return {
                    id: d.id, ...data,
                    display_order_number: data.order_number || d.id,
                    display_date_str: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit' }),
                    real_date: date,
                    display_channel: data.channel_store_name || 'Manual POS',
                    display_status: data.status || 'completed',
                    fin_gross: data.financial?.total_sales ?? data.gross_amount ?? 0,
                    fin_cost: data.financial?.total_hpp ?? 0,
                    fin_profit: data.financial?.gross_profit ?? 0,
                    op_courier: data.operational?.courier ?? '-',
                    op_tracking: data.operational?.awb_number ?? '',
                };
            });
            setOrders(list);
        } catch(e) { 
            console.error(e); 
            // Fallback jika index belum dibuat atau field error
            toast.error("Gagal memuat data. Pastikan index Firestore sudah aktif."); 
        } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchOrders(); }, []);

    // 2. ACTIONS (VOID / DELETE)
    const handleDelete = async (order) => {
        if (!confirm(`PERINGATAN: Menghapus #${order.display_order_number} akan mengembalikan STOK dan membatalkan KEUANGAN. Lanjut?`)) return;
        
        const tId = toast.loading("Memproses Void...");
        try {
            const batch = writeBatch(db);
            const settingSnap = await getDoc(doc(db, "settings", "general"));
            const financeConfig = settingSnap.exists() ? settingSnap.data().financeConfig : null;

            // A. Revert Stock
            const itemsSnap = await getDocs(collection(db, `sales_orders/${order.id}/items`));
            itemsSnap.forEach((itemDoc) => {
                const item = itemDoc.data();
                const snapId = `${item.variant_id}_${order.warehouse_id}`;
                batch.update(doc(db, "stock_snapshots", snapId), { qty: increment(item.qty) });
                batch.set(doc(collection(db, "stock_movements")), {
                    variant_id: item.variant_id, warehouse_id: order.warehouse_id,
                    type: 'adjustment_in', qty: item.qty, date: serverTimestamp(),
                    ref_id: order.id, notes: `Void Sales #${order.display_order_number}`
                });
            });

            // B. Revert Finance (Reverse Journal)
            if (financeConfig && order.payment_status === 'paid' && order.payment_account_id) {
                batch.set(doc(collection(db, "cash_transactions")), {
                    account_id: order.payment_account_id, type: 'out', amount: order.fin_gross,
                    debit: 0, credit: order.fin_gross, category: 'Void Sales',
                    description: `Void #${order.display_order_number}`, ref_id: order.id,
                    created_at: serverTimestamp(), date: serverTimestamp()
                });
                batch.update(doc(db, "chart_of_accounts", order.payment_account_id), { balance: increment(-order.fin_gross) });
                
                if(financeConfig.defaultRevenueId) batch.update(doc(db, "chart_of_accounts", financeConfig.defaultRevenueId), { balance: increment(-order.fin_gross) });
                
                if (order.fin_cost > 0) {
                    if(financeConfig.defaultInventoryId) batch.update(doc(db, "chart_of_accounts", financeConfig.defaultInventoryId), { balance: increment(order.fin_cost) });
                    if(financeConfig.defaultCOGSId) batch.update(doc(db, "chart_of_accounts", financeConfig.defaultCOGSId), { balance: increment(-order.fin_cost) });
                }
            }

            batch.delete(doc(db, "sales_orders", order.id));
            await batch.commit();
            
            localStorage.removeItem('lumina_sales_history_v2');
            localStorage.removeItem('lumina_dash_master_v4');
            
            toast.success("Transaksi Dibatalkan (Void)", { id: tId });
            fetchOrders(); 

        } catch (e) { toast.error("Gagal Void: " + e.message, { id: tId }); }
    };

    // 3. EDIT HANDLERS
    const startEdit = (order) => {
        setEditingId(order.id);
        setEditForm({
            awb_number: order.op_tracking,
            shipping_fee: order.financial?.shipping_fee || 0,
            service_fee: order.financial?.service_fee || 0,
            discount: order.financial?.discount || 0,
        });
    };

    const saveEdit = async (orderId, originalOrder) => {
        try {
            const subtotal = originalOrder.financial?.subtotal || 0;
            const cost = originalOrder.fin_cost || 0;
            
            const discount = Number(editForm.discount);
            const ship = Number(editForm.shipping_fee);
            const serv = Number(editForm.service_fee);
            
            const netSales = subtotal - discount;
            const grossProfit = netSales - cost - serv; 

            await updateDoc(doc(db, "sales_orders", orderId), {
                "operational.awb_number": editForm.awb_number,
                "financial.shipping_fee": ship,
                "financial.service_fee": serv,
                "financial.discount": discount,
                "financial.gross_profit": grossProfit,
                "financial.total_sales": netSales,
                updated_at: serverTimestamp()
            });
            
            toast.success("Updated!");
            setEditingId(null); fetchOrders();
        } catch (e) { toast.error("Gagal update"); }
    };

    // 4. FILTER LOGIC
    const filteredOrders = orders.filter(o => {
        const matchCh = filterChannel === 'all' || o.display_channel === filterChannel;
        const matchSt = filterStatus === 'all' || o.display_status === filterStatus;
        const matchSearch = !searchQuery || o.display_order_number.toLowerCase().includes(searchQuery.toLowerCase()) || o.buyer_name?.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchDate = true;
        if (dateRange.from) {
            const d = new Date(o.real_date);
            const from = new Date(dateRange.from); from.setHours(0,0,0,0);
            const to = new Date(dateRange.to || dateRange.from); to.setHours(23,59,59,999);
            matchDate = d >= from && d <= to;
        }
        return matchCh && matchSt && matchSearch && matchDate;
    });

    const getItemsList = (order) => order.items_preview?.map(i => ({
        sku: i.sku || i.variant_id, qty: i.qty, name: i.product_name, variant: i.variant_name,
        price: i.unit_price || 0
    })) || [];

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            <PageHeader title="Riwayat Transaksi" subtitle="Monitor penjualan dan kelola pembatalan (Void)." actions={
                <button onClick={fetchOrders} className="bg-white hover:bg-gray-50 border border-border rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm"><RotateCcw className={`w-4 h-4 ${loading?'animate-spin':''}`}/><span className="text-xs font-bold">Refresh</span></button>
            }/>

            {/* FILTERS */}
            <div className="bg-white p-4 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-3"/><input type="text" placeholder="Cari Order ID / Nama..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-border rounded-xl focus:outline-none focus:border-primary"/></div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="flex items-center gap-1 bg-gray-50 border border-border rounded-xl px-2"><Calendar className="w-4 h-4 text-gray-400"/><input type="date" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent border-none text-xs p-2 outline-none"/></div>
                    <div className="relative min-w-[140px]"><Filter className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-500"/><select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="w-full pl-9 pr-8 py-2.5 text-xs font-bold bg-white border border-border rounded-xl appearance-none"><option value="all">Semua Channel</option><option value="Manual POS">Manual POS</option></select><ChevronDown className="w-3.5 h-3.5 absolute right-3 top-3 pointer-events-none"/></div>
                </div>
            </div>

            {/* VIEWS */}
            <TransactionTable 
                orders={filteredOrders} loading={loading} expandedId={expandedId} setExpandedId={setExpandedId}
                getItemsList={getItemsList} editingId={editingId} editForm={editForm} setEditForm={setEditForm}
                onStartEdit={startEdit} onCancelEdit={()=>setEditingId(null)} onSaveEdit={saveEdit} onDelete={handleDelete}
            />
            
            <TransactionCardList 
                orders={filteredOrders} loading={loading} expandedId={expandedId} setExpandedId={setExpandedId}
                getItemsList={getItemsList} editingId={editingId} editForm={editForm} setEditForm={setEditForm}
                onStartEdit={startEdit} onCancelEdit={()=>setEditingId(null)} onSaveEdit={saveEdit} onDelete={handleDelete}
            />
        </div>
    );
}