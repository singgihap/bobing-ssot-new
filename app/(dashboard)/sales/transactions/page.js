"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';

// --- MODERN UI IMPORTS ---
import { 
    Search, RotateCcw, Filter, Calendar, ChevronDown, ChevronRight, ChevronUp,
    Edit2, Save, X, Package, Truck, User, CreditCard, 
    TrendingUp, CheckCircle, Clock, ExternalLink 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TransactionsHistoryPage() {
    // --- 1. SETUP DEFAULT DATE (HARI INI) ---
    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filter State
    const [filterChannel, setFilterChannel] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ from: getTodayString(), to: getTodayString() });
    
    // UI State
    const [expandedOrders, setExpandedOrders] = useState({});
    const [sectionState, setSectionState] = useState({}); 

    // Editing State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchOrders(); }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const q = query(
                collection(db, "sales_orders"), 
                orderBy("order_created_at", "desc"), 
                limit(500) 
            );
            const snap = await getDocs(q);
            
            const ordersList = [];
            snap.forEach(d => {
                const data = d.data();
                ordersList.push({
                    id: d.id,
                    ...data,
                    display_order_number: data.order_id_marketplace || data.order_number || data.order_id_desty || d.id,
                    display_date: data.order_created_at || data.order_date,
                    real_date: data.marketplace_created_at ? (data.marketplace_created_at.toDate ? data.marketplace_created_at.toDate() : new Date(data.marketplace_created_at)) : null,
                    display_channel: data.channel_store_name || data.channel_id || 'Unknown',
                    
                    display_status: data.status || 'pending', 
                    payment_method: data.payment_method || 'Unknown', 

                    fin_subtotal: data.financial?.subtotal || 0,
                    fin_gross: data.financial?.total_sales ?? data.gross_amount ?? 0,
                    fin_cost: data.financial?.total_hpp ?? data.total_cost ?? 0,
                    fin_net: data.financial?.net_payout ?? data.net_amount ?? 0,
                    fin_profit: data.financial?.gross_profit ?? data.profit ?? 0,
                    
                    op_courier: data.operational?.courier ?? data.courier ?? '-',
                    op_tracking: data.operational?.awb_number ?? data.tracking_number ?? '',
                });
            });
            setOrders(ordersList);
        } catch(e) {
            console.error('Error fetching orders:', e);
            toast.error("Gagal memuat data");
        } finally {
            setLoading(false);
        }
    };

    // --- ACCORDION TOGGLE ---
    const toggleSection = (orderId, section) => {
        setSectionState(prev => ({
            ...prev,
            [orderId]: {
                ...prev[orderId],
                [section]: !prev[orderId]?.[section]
            }
        }));
    };

    // --- EDIT HANDLERS ---
    const startEdit = (order) => {
        setEditingId(order.id);
        setEditForm({
            awb_number: order.operational?.awb_number || '',
            shipping_fee: order.financial?.shipping_fee || 0,
            service_fee: order.financial?.service_fee || 0,
            discount: order.financial?.discount || 0,
            refund: order.financial?.refund || 0,
            tax: order.financial?.tax || 0, // PAJAK
            affiliate_commission: order.financial?.affiliate_commission || 0,
        });
        setSectionState(prev => ({
            ...prev,
            [order.id]: { ...prev[order.id], finance: true }
        }));
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async (orderId, originalOrder) => {
        if(!confirm("Simpan perubahan?")) return;
        setSaving(true);
        try {
            const orderRef = doc(db, "sales_orders", orderId);
            const subtotal = originalOrder.financial?.subtotal || originalOrder.fin_gross || 0;
            const totalHPP = originalOrder.financial?.total_hpp || 0;

            const valShipping = Number(editForm.shipping_fee);
            const valService = Number(editForm.service_fee);
            const valDiscount = Number(editForm.discount);
            const valRefund = Number(editForm.refund);
            const valTax = Number(editForm.tax);
            const valAffiliate = Number(editForm.affiliate_commission);

            const revenueFromGoods = subtotal - valDiscount - valRefund;
            const expenses = valShipping + valService + valTax + valAffiliate;
            const newNetPayout = revenueFromGoods - expenses;
            const newGrossProfit = newNetPayout - totalHPP;

            const updatePayload = {
                "operational.awb_number": editForm.awb_number,
                "financial.shipping_fee": valShipping,
                "financial.service_fee": valService,
                "financial.discount": valDiscount,
                "financial.refund": valRefund,
                "financial.tax": valTax,
                "financial.affiliate_commission": valAffiliate,
                "financial.net_payout": newNetPayout,
                "financial.gross_profit": newGrossProfit,
                "updated_at": serverTimestamp()
            };

            await updateDoc(orderRef, updatePayload);
            toast.success("Data updated!");
            setEditingId(null);
            fetchOrders(); 
        } catch (e) {
            toast.error("Gagal update: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // --- FILTER LOGIC ---
    const filteredOrders = orders.filter(order => {
        const matchChannel = filterChannel === 'all' || order.display_channel === filterChannel;
        const matchStatus = filterStatus === 'all' || order.display_status === filterStatus;
        const searchLower = searchQuery.toLowerCase();
        const matchSearch = !searchQuery || 
            (order.display_order_number || '').toLowerCase().includes(searchLower) ||
            (order.buyer_name || order.customer_name || '').toLowerCase().includes(searchLower);
        
        let matchDate = true;
        const dVal = order.display_date;
        const orderDate = dVal ? (dVal.toDate ? dVal.toDate() : new Date(dVal)) : new Date();

        if(dateRange.from) {
            const from = new Date(dateRange.from); from.setHours(0,0,0,0);
            matchDate = orderDate >= from;
        }
        if(dateRange.from && dateRange.to) {
             const from = new Date(dateRange.from); from.setHours(0,0,0,0);
             const to = new Date(dateRange.to); to.setHours(23, 59, 59); 
             matchDate = orderDate >= from && orderDate <= to;
        }
        return matchChannel && matchStatus && matchSearch && matchDate;
    });

    const handleSeeAll = () => setDateRange({ from: '', to: '' });
    const channels = ['all', ...new Set(orders.map(o => o.display_channel).filter(Boolean))];
    const statuses = ['all', ...new Set(orders.map(o => o.display_status).filter(Boolean))];

    const metrics = {
        totalOrders: filteredOrders.length,
        totalRevenue: filteredOrders.reduce((sum, o) => sum + (o.fin_gross || 0), 0),
        totalCost: filteredOrders.reduce((sum, o) => sum + (o.fin_cost || 0), 0),
        totalProfit: filteredOrders.reduce((sum, o) => sum + (o.fin_profit || 0), 0),
    };
    metrics.avgOrderValue = metrics.totalOrders > 0 ? Math.round(metrics.totalRevenue / metrics.totalOrders) : 0;
    const profitMargin = metrics.totalRevenue > 0 ? ((metrics.totalProfit / metrics.totalRevenue) * 100).toFixed(1) : 0;

    const formatDate = (date) => {
        if(!date) return '-';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit', hour:'2-digit', minute:'2-digit' });
        } catch(e) { return '-'; }
    };

    const getItemsList = (order) => {
        if (Array.isArray(order.items_preview) && order.items_preview.length > 0) {
            return order.items_preview.map(i => ({
                sku: i.sku || i.variant_id, qty: i.qty, name: i.product_name, variant: i.variant_name,
                price: i.unit_price || 0, original_price: i.original_price || 0
            }));
        }
        return [];
    };

    const getStatusBadge = (status) => {
        const s = String(status).toLowerCase();
        let classes = "bg-gray-100 text-gray-600 border-gray-200";
        let icon = <Clock className="w-3 h-3 mr-1"/>;
        
        if (s.includes('completed') || s.includes('selesai')) { classes = "bg-emerald-50 text-emerald-700 border-emerald-100"; icon = <CheckCircle className="w-3 h-3 mr-1"/>; }
        else if (s.includes('delivered') || s.includes('diterima')) { classes = "bg-teal-50 text-teal-700 border-teal-100"; icon = <CheckCircle className="w-3 h-3 mr-1"/>; }
        else if (s.includes('in_delivery') || s.includes('dikirim')) { classes = "bg-blue-50 text-blue-700 border-blue-100"; icon = <Truck className="w-3 h-3 mr-1"/>; }
        else if (s.includes('processed') || s.includes('diproses')) { classes = "bg-amber-50 text-amber-700 border-amber-100"; icon = <Clock className="w-3 h-3 mr-1"/>; }
        else if (s.includes('cancel') || s.includes('batal')) { classes = "bg-rose-50 text-rose-700 border-rose-100"; icon = <X className="w-3 h-3 mr-1"/>; }
        
        return <span className={`flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${classes}`}>{icon} {status}</span>;
    };

    const isTodayFilter = dateRange.from === getTodayString() && dateRange.to === getTodayString();

    // Reusable Metric Card
    const MetricCard = ({ title, value, sub, icon: Icon, colorClass }) => (
        <div className="bg-white p-4 rounded-2xl border border-border shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">{title}</p>
                <h3 className={`text-xl font-display font-bold ${colorClass}`}>{value}</h3>
                {sub && <p className="text-[10px] text-text-secondary mt-1">{sub}</p>}
            </div>
            <div className={`p-2 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '50').replace('700', '50').replace('500', '50')} ${colorClass}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-display font-bold text-text-primary">Riwayat Transaksi</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isTodayFilter ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        <p className="text-sm text-text-secondary font-light">
                            {isTodayFilter ? "Live View: Transaksi Hari Ini" : "Arsip Transaksi"}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isTodayFilter && (
                        <button onClick={handleSeeAll} className="bg-white border border-border text-text-secondary hover:text-primary hover:border-primary px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Lihat Semua
                        </button>
                    )}
                    <button onClick={fetchOrders} className="bg-white hover:bg-gray-50 text-text-primary border border-border rounded-xl px-4 py-2 flex items-center gap-2 transition-colors shadow-sm active:scale-95">
                        <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="text-xs font-bold">Refresh</span>
                    </button>
                </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                <MetricCard title="Total Orders" value={metrics.totalOrders} icon={Package} colorClass="text-text-primary" />
                <MetricCard title="Gross Sales" value={formatRupiah(metrics.totalRevenue)} icon={CreditCard} colorClass="text-emerald-600" />
                <MetricCard title="Total HPP" value={formatRupiah(metrics.totalCost)} icon={TrendingUp} colorClass="text-rose-500" />
                <MetricCard title="Net Profit" value={formatRupiah(metrics.totalProfit)} sub={`${profitMargin}% Margin`} icon={TrendingUp} colorClass="text-blue-600" />
                <MetricCard title="Avg. Value" value={formatRupiah(metrics.avgOrderValue)} icon={CreditCard} colorClass="text-indigo-600" />
            </div>

            {/* FILTERS */}
            <div className="bg-white p-4 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full group">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Cari Order ID, Nama Pelanggan..." 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-border rounded-xl focus:outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="relative min-w-[140px]">
                        <Filter className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                        <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="w-full pl-9 pr-8 py-2.5 text-xs font-bold bg-white border border-border rounded-xl appearance-none focus:outline-none focus:border-primary cursor-pointer">
                            <option value="all">Semua Channel</option>
                            {channels.filter(c=>c!=='all').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                    </div>
                    <div className="relative min-w-[140px]">
                        <Filter className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full pl-9 pr-8 py-2.5 text-xs font-bold bg-white border border-border rounded-xl appearance-none focus:outline-none focus:border-primary cursor-pointer">
                            <option value="all">Semua Status</option>
                            {statuses.filter(s=>s!=='all').map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 border border-border rounded-xl px-2">
                        <input type="date" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent border-none text-xs p-2 focus:ring-0 text-text-secondary font-medium" />
                        <span className="text-gray-300">-</span>
                        <input type="date" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} className="bg-transparent border-none text-xs p-2 focus:ring-0 text-text-secondary font-medium" />
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 sticky top-0 z-10 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                            <tr>
                                <th className="w-12 py-4 pl-6"></th>
                                <th className="py-4 px-4">Date & Order ID</th>
                                <th className="py-4 px-4">Customer Info</th>
                                <th className="py-4 px-4 text-center">Channel</th>
                                <th className="py-4 px-4 text-center">Status</th>
                                <th className="py-4 px-4 text-right">Gross Sales</th>
                                <th className="py-4 px-4 text-right">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-text-primary divide-y divide-border/60">
                            {loading ? (
                                <tr><td colSpan="9" className="text-center py-20 text-text-secondary animate-pulse">Memuat data transaksi...</td></tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-20">
                                        <div className="flex flex-col items-center justify-center text-text-secondary opacity-60">
                                            <Package className="w-12 h-12 mb-2" />
                                            <p>Tidak ada data ditemukan</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const items = getItemsList(order);
                                    const isExpanded = expandedOrders[order.id];
                                    const isEditing = editingId === order.id;
                                    const profitPct = order.fin_gross > 0 ? ((order.fin_profit / order.fin_gross) * 100).toFixed(0) : 0;
                                    
                                    const isCustomerOpen = sectionState[order.id]?.customer;
                                    const isFinanceOpen = sectionState[order.id]?.finance;

                                    return (
                                        <React.Fragment key={order.id}>
                                            <tr 
                                                onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))} 
                                                className={`cursor-pointer transition-colors hover:bg-blue-50/30 ${isExpanded ? 'bg-blue-50/40 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                                            >
                                                <td className="py-4 pl-6 text-center text-text-secondary">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="font-mono text-xs text-text-secondary mb-0.5">{formatDate(order.display_date)}</div>
                                                    <div className="font-bold text-text-primary flex items-center gap-1 hover:text-primary transition-colors" title="View details">
                                                        {order.display_order_number}
                                                        {order.order_id_desty && <ExternalLink className="w-3 h-3 opacity-50" />}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="font-medium text-text-primary">{order.buyer_name || 'Guest'}</div>
                                                    <div className="text-xs text-text-secondary truncate max-w-[150px]">{order.payment_method}</div>
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <span className="bg-gray-100 text-text-secondary px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-tight border border-border">
                                                        {order.display_channel}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 flex justify-center">
                                                    {getStatusBadge(order.display_status)}
                                                </td>
                                                <td className="py-4 px-4 text-right font-display font-bold text-text-primary">
                                                    {formatRupiah(order.fin_gross)}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-bold font-mono ${order.fin_profit>=0?'text-emerald-600':'text-rose-600'}`}>
                                                            {formatRupiah(order.fin_profit)}
                                                        </span>
                                                        <span className="text-[9px] bg-gray-100 px-1.5 rounded text-text-secondary mt-0.5">
                                                            {profitPct}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.tr 
                                                        initial={{ opacity: 0, height: 0 }} 
                                                        animate={{ opacity: 1, height: 'auto' }} 
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="bg-gray-50/50 shadow-inner"
                                                    >
                                                        <td colSpan="9" className="p-0 cursor-default border-t border-border/50">
                                                            <div className="p-6 pl-14 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                                                                
                                                                <div className="absolute top-4 right-6 z-10">
                                                                    {isEditing ? (
                                                                        <div className="flex gap-2">
                                                                            <button onClick={cancelEdit} className="btn-ghost-dark text-xs px-3 py-1.5 bg-white shadow-sm">Batal</button>
                                                                            <button onClick={()=>saveEdit(order.id, order)} disabled={saving} className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 flex items-center gap-1 shadow-md">
                                                                                <Save className="w-3 h-3"/> Simpan
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={()=>startEdit(order)} className="text-xs text-primary hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-blue-50 transition-colors">
                                                                            <Edit2 className="w-3 h-3"/> Edit Data
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* ITEMS */}
                                                                <div className="md:col-span-2 space-y-3">
                                                                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                                                                        <Package className="w-4 h-4"/> Item Details ({items.length})
                                                                    </h4>
                                                                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                                        {items.map((item, i) => (
                                                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border shadow-sm">
                                                                                <div className="flex-1 mr-4">
                                                                                    <div className="text-sm font-bold text-text-primary line-clamp-1">{item.name}</div>
                                                                                    <div className="text-[10px] text-text-secondary font-mono flex gap-2 mt-1">
                                                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{item.sku}</span>
                                                                                        {item.variant !== '-' && <span className="opacity-80">{item.variant}</span>}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <div className="text-sm font-bold text-emerald-600 font-mono">{formatRupiah(item.price * item.qty)}</div>
                                                                                    <div className="text-[10px] text-text-secondary mt-0.5">
                                                                                        {item.qty} x {formatRupiah(item.price)}
                                                                                        {item.original_price > item.price && (
                                                                                            <span className="ml-1 text-text-secondary opacity-50 line-through decoration-rose-400">{formatRupiah(item.original_price)}</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* DETAILS */}
                                                                <div className="space-y-4 font-mono text-xs border-l border-border pl-6">
                                                                    
                                                                    {/* Shipping */}
                                                                    <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                                                                        <div className="flex items-center gap-2 text-text-secondary uppercase font-bold text-[10px] mb-2">
                                                                            <Truck className="w-3.5 h-3.5"/> Pengiriman
                                                                        </div>
                                                                        <div className="text-text-primary font-bold text-sm mb-1">{order.op_courier}</div>
                                                                        {isEditing ? (
                                                                            <input className="input-luxury w-full py-1.5 text-xs mt-1" placeholder="Input No. Resi / AWB" value={editForm.awb_number} onChange={e=>setEditForm({...editForm, awb_number:e.target.value})} />
                                                                        ) : (
                                                                            <div className={`text-[10px] break-all inline-block px-2 py-1 rounded-md font-medium ${order.op_tracking ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-100 text-gray-400 italic'}`}>
                                                                                {order.op_tracking || 'No Resi Input'}
                                                                            </div>
                                                                        )}
                                                                        {order.real_date && <div className="mt-2 text-[10px] text-text-secondary">Dibuat: {formatDate(order.real_date)}</div>}
                                                                    </div>

                                                                    {/* Customer */}
                                                                    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                                                                        <button onClick={()=>toggleSection(order.id, 'customer')} className="w-full flex justify-between items-center p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-border/50">
                                                                            <span className="text-[10px] font-bold text-text-secondary uppercase flex items-center gap-2"><User className="w-3.5 h-3.5"/> Customer</span>
                                                                            <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${isCustomerOpen?'rotate-90':''}`}/>
                                                                        </button>
                                                                        {isCustomerOpen && (
                                                                            <div className="p-3 space-y-2 bg-white animate-slide-up">
                                                                                <div><div className="text-[10px] text-text-secondary">Nama</div><div className="font-bold text-text-primary">{order.buyer_name || 'Guest'}</div></div>
                                                                                <div><div className="text-[10px] text-text-secondary">Kontak</div><div>{order.buyer_phone || '-'}</div></div>
                                                                                <div><div className="text-[10px] text-text-secondary">Alamat</div><div className="leading-tight text-text-secondary">{order.buyer_address || '-'}</div></div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Finance Detail (ADA PAJAK) */}
                                                                    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                                                                        <button onClick={()=>toggleSection(order.id, 'finance')} className="w-full flex justify-between items-center p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-border/50">
                                                                            <span className="text-[10px] font-bold text-text-secondary uppercase flex items-center gap-2"><CreditCard className="w-3.5 h-3.5"/> Finance</span>
                                                                            <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${isFinanceOpen?'rotate-90':''}`}/>
                                                                        </button>
                                                                        
                                                                        {isFinanceOpen && (
                                                                            <div className="p-3 space-y-1.5 bg-white animate-slide-up text-[11px]">
                                                                                <div className="flex justify-between items-center text-text-secondary"><span>(+) Subtotal</span><span>{formatRupiah(order.financial?.subtotal || order.fin_gross)}</span></div>
                                                                                <div className="flex justify-between items-center text-rose-500"><span>(-) Diskon</span>{isEditing ? <input type="number" className="w-20 text-right border rounded px-1" value={editForm.discount} onChange={e=>setEditForm({...editForm, discount:e.target.value})} /> : <span>{formatRupiah(order.financial?.discount || 0)}</span>}</div>
                                                                                <div className="flex justify-between items-center text-rose-500"><span>(-) Refund</span>{isEditing ? <input type="number" className="w-20 text-right border rounded px-1" value={editForm.refund} onChange={e=>setEditForm({...editForm, refund:e.target.value})} /> : <span>{formatRupiah(order.financial?.refund || 0)}</span>}</div>
                                                                                <div className="flex justify-between items-center text-text-secondary"><span>(-) Ongkir</span>{isEditing ? <input type="number" className="w-20 text-right border rounded px-1" value={editForm.shipping_fee} onChange={e=>setEditForm({...editForm, shipping_fee:e.target.value})} /> : <span>{formatRupiah(order.financial?.shipping_fee || 0)}</span>}</div>
                                                                                <div className="flex justify-between items-center text-text-secondary"><span>(-) Admin</span>{isEditing ? <input type="number" className="w-20 text-right border rounded px-1" value={editForm.service_fee} onChange={e=>setEditForm({...editForm, service_fee:e.target.value})} /> : <span>{formatRupiah(order.financial?.service_fee || 0)}</span>}</div>
                                                                                
                                                                                {/* ITEM BARU: PAJAK */}
                                                                                <div className="flex justify-between items-center text-text-secondary">
                                                                                    <span>(-) Pajak</span>
                                                                                    {isEditing ? <input type="number" className="w-20 text-right border rounded px-1" value={editForm.tax} onChange={e=>setEditForm({...editForm, tax:e.target.value})} /> : <span>{formatRupiah(order.financial?.tax || 0)}</span>}
                                                                                </div>

                                                                                <div className="flex justify-between items-center text-amber-500"><span>(-) Affiliate</span>{isEditing ? <input type="number" className="w-20 text-right border rounded px-1" value={editForm.affiliate_commission} onChange={e=>setEditForm({...editForm, affiliate_commission:e.target.value})} /> : <span>{formatRupiah(order.financial?.affiliate_commission || 0)}</span>}</div>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        <div className="p-3 border-t border-dashed border-border bg-emerald-50/30 flex justify-between items-center">
                                                                            <span className="text-[10px] font-bold text-emerald-700 uppercase">(=) Net Payout</span>
                                                                            <span className="font-bold text-emerald-700">{formatRupiah(order.fin_net)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                )}
                                            </AnimatePresence>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}