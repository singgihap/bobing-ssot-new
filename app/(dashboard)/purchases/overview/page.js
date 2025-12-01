"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, serverTimestamp, increment, getDoc, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

import PurchaseTable from './components/PurchaseTable';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import BatchPaymentModal from './components/BatchPaymentModal';
import { Plus, Search, FileText, Zap } from 'lucide-react';
import { recordPurchaseTransaction, recordTransaction } from '@/lib/transactionService';
import { createNotification } from '@/lib/notificationService';

// 👇 IMPORT BARU
import { getCache, setCache, invalidateSmart, CACHE_KEYS, DURATION } from '@/lib/cacheManager';

export default function PurchasesPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [variants, setVariants] = useState([]);
    const [wallets, setWallets] = useState([]); 
    const [financeConfig, setFinanceConfig] = useState({});

    const [modalOpen, setModalOpen] = useState(false);
    const [devModalOpen, setDevModalOpen] = useState(false);
    const [editingPO, setEditingPO] = useState(null);

    useEffect(() => { fetchHistory(); fetchMasterData(); }, []);

    const fetchHistory = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache
            if (!forceRefresh) {
                const cached = getCache(CACHE_KEYS.PURCHASES_HISTORY, DURATION.MEDIUM);
                if (cached) {
                    setHistory(cached.map(d => ({ ...d, order_date: new Date(d.order_date) })));
                    setLoading(false);
                    return;
                }
            }
            // 2. Fetch Firebase
            const q = query(collection(db, "purchase_orders"), orderBy("order_date", "desc"), limit(50));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data(), order_date: d.data().order_date.toDate() }));
            
            setHistory(data);
            setCache(CACHE_KEYS.PURCHASES_HISTORY, data); // 3. Simpan Cache

        } catch (e) { toast.error("Gagal memuat history"); } 
        finally { setLoading(false); }
    };

    // fetchMasterData logic remains same, can be cached too if needed but optional for now as they are small lists generally
    const fetchMasterData = async () => {
        try {
            const [whS, supS, prodS, varS, accS, setS] = await Promise.all([
                getDocs(collection(db, "warehouses")),
                getDocs(collection(db, "suppliers")),
                getDocs(collection(db, "products")),
                getDocs(collection(db, "product_variants")),
                getDocs(query(collection(db, "chart_of_accounts"), orderBy("code"))),
                getDoc(doc(db, "settings", "general"))
            ]);
            setWarehouses(whS.docs.map(d=>({id:d.id, ...d.data()})));
            setSuppliers(supS.docs.map(d=>({id:d.id, ...d.data()})));
            setProducts(prodS.docs.map(d=>({id:d.id, ...d.data()})));
            setVariants(varS.docs.map(d=>({id:d.id, ...d.data()})));
            setWallets(accS.docs.map(d => ({id:d.id, ...d.data()})).filter(a => a.code.startsWith('1') && (a.category?.includes('ASET') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))));
            if(setS.exists()) setFinanceConfig(setS.data().financeConfig || {});
        } catch(e) { console.error(e); }
    };

    // ... (Handle Edit same as before) ...
    const handleEdit = async (po) => {
        const tId = toast.loading("Loading PO...");
        try {
            const itemsSnap = await getDocs(collection(db, `purchase_orders/${po.id}/items`));
            const cart = itemsSnap.docs.map(d => {
                const i = d.data();
                const v = variants.find(x => x.id === i.variant_id);
                const p = products.find(x => x.id === v?.product_id);
                return {
                    variant_id: i.variant_id, qty: i.qty, unit_cost: i.unit_cost,
                    sku: v?.sku, name: p?.name, spec: v ? `${v.color}/${v.size}` : '-'
                };
            });
            setEditingPO({
                id: po.id,
                supplier_id: suppliers.find(s => s.name === po.supplier_name)?.id || '',
                warehouse_id: po.warehouse_id,
                date: new Date(po.order_date).toISOString().split('T')[0],
                isPaid: po.payment_status === 'paid',
                wallet_id: '',
                cart
            });
            setModalOpen(true);
            toast.dismiss(tId);
        } catch (e) { toast.error("Gagal load edit"); }
    };

    const handleSubmitPO = async (formData, cart) => {
        if(cart.length === 0) return toast.error("Keranjang kosong");
        if(formData.isPaid && !formData.wallet_id) return toast.error("Pilih Akun Pembayaran!");
        
        const isEditMode = !!editingPO?.id;
        const toastId = toast.loading("Processing PO...");
        let finalPoId = null; 

        try {
            const totalAmount = cart.reduce((a,b) => a + (b.qty * b.unit_cost), 0);
            const totalQty = cart.reduce((a,b) => a + b.qty, 0);
            const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name || 'Unknown';
            
            await runTransaction(db, async (t) => {
                let oldItems = [];
                let oldPOData = null;

                if (isEditMode) {
                    const oldPORef = doc(db, "purchase_orders", editingPO.id);
                    oldPOData = (await t.get(oldPORef)).data();
                    const oldItemsSnap = await getDocs(collection(db, `purchase_orders/${editingPO.id}/items`));
                    oldItems = oldItemsSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
                    oldItems.forEach(item => t.delete(doc(db, `purchase_orders/${editingPO.id}/items`, item.docId)));
                }

                const poRef = isEditMode ? doc(db, "purchase_orders", editingPO.id) : doc(collection(db, "purchase_orders"));
                finalPoId = poRef.id;

                const poData = { 
                    supplier_name: supplierName, warehouse_id: formData.warehouse_id, 
                    order_date: new Date(formData.date), status: 'received_full', 
                    total_amount: totalAmount, total_qty: totalQty, 
                    payment_status: formData.isPaid ? 'paid' : 'unpaid', 
                    amount_paid: formData.isPaid ? totalAmount : 0, 
                    updated_at: serverTimestamp(), updated_by: user?.email 
                };
                if (!isEditMode) { poData.created_at = serverTimestamp(); poData.created_by = user?.email; }
                t.set(poRef, poData, { merge: true });

                const snapshotMap = {}; 
                const snapIdsToRead = new Set();
                if (isEditMode) oldItems.forEach(item => snapIdsToRead.add(`${item.variant_id}_${oldPOData.warehouse_id}`));
                cart.forEach(item => snapIdsToRead.add(`${item.variant_id}_${formData.warehouse_id}`));
                const snapKeys = Array.from(snapIdsToRead);
                const snapReads = await Promise.all(snapKeys.map(key => t.get(doc(db, "stock_snapshots", key))));
                snapKeys.forEach((key, index) => snapshotMap[key] = snapReads[index]);

                const stockChanges = {};
                if (isEditMode) {
                    oldItems.forEach(item => {
                        const key = `${item.variant_id}_${oldPOData.warehouse_id}`;
                        stockChanges[key] = (stockChanges[key] || 0) - item.qty;
                    });
                }
                cart.forEach(item => {
                    const key = `${item.variant_id}_${formData.warehouse_id}`;
                    stockChanges[key] = (stockChanges[key] || 0) + item.qty;
                    const newItemRef = doc(collection(db, `purchase_orders/${poRef.id}/items`));
                    t.set(newItemRef, { variant_id: item.variant_id, qty: item.qty, unit_cost: item.unit_cost, subtotal: item.qty*item.unit_cost });
                    const moveRef = doc(collection(db, "stock_movements"));
                    t.set(moveRef, { variant_id: item.variant_id, warehouse_id: formData.warehouse_id, type: 'purchase_in', qty: item.qty, unit_cost: item.unit_cost, ref_id: poRef.id, ref_type: 'purchase_order', date: serverTimestamp(), notes: isEditMode ? `PO Upd ${supplierName}` : `PO ${supplierName}` });
                });

                Object.entries(stockChanges).forEach(([key, delta]) => {
                    if (delta === 0) return;
                    const snapDoc = snapshotMap[key];
                    const [varId, whId] = key.split('_');
                    const snapRef = doc(db, "stock_snapshots", key);
                    if (snapDoc && snapDoc.exists()) t.update(snapRef, { qty: increment(delta) });
                    else t.set(snapRef, { id: key, variant_id: varId, warehouse_id: whId, qty: delta });
                });

                if (!isEditMode) {
                    recordPurchaseTransaction(db, t, { poId: poRef.id, totalAmount, isPaid: formData.isPaid, walletId: formData.wallet_id, supplierName, financeConfig });
                }
            });

            if (!isEditMode) {
                await createNotification({ title: "PO Baru Berhasil", message: `PO ke ${supplierName} senilai ${formatRupiah(totalAmount)} telah dibuat.`, type: "success", link: `/purchases/${finalPoId}` });
            }

            // 4. INVALIDATE SMART
            invalidateSmart('PURCHASE');

            toast.success("PO Berhasil!", { id: toastId });
            setModalOpen(false); fetchHistory(true); setEditingPO(null);
        } catch(e) { console.error(e); toast.error(`Gagal: ${e.message}`, { id: toastId }); }
    };

    const handleDelete = async (po) => {
        if(!confirm(`Yakin hapus PO dari ${po.supplier_name}? Stok akan ditarik kembali.`)) return;
        const tId = toast.loading("Menghapus...");
        try {
            // ... (Logic Delete items/snapshots/movements same as before) ...
            const itemsSnap = await getDocs(collection(db, `purchase_orders/${po.id}/items`));
            const itemsToDelete = itemsSnap.docs.map(d => d.data());

            await runTransaction(db, async (t) => {
                const snapReads = await Promise.all(itemsToDelete.map(item => t.get(doc(db, "stock_snapshots", `${item.variant_id}_${po.warehouse_id}`))));
                itemsToDelete.forEach((item, index) => {
                    const snapDoc = snapReads[index];
                    if (snapDoc.exists()) t.update(snapDoc.ref, { qty: increment(-item.qty) });
                    t.set(doc(collection(db, "stock_movements")), { variant_id: item.variant_id, warehouse_id: po.warehouse_id, type: 'adjustment_opname', qty: -item.qty, ref_id: po.id, ref_type: 'purchase_order_void', date: serverTimestamp(), notes: `Void PO ${po.id.substring(0,8)}` });
                });
                if (po.payment_status === 'paid' && po.total_amount > 0 && wallets[0]?.id) {
                    t.set(doc(collection(db, "cash_transactions")), { account_id: wallets[0].id, type: 'in', amount: po.total_amount, debit: po.total_amount, credit: 0, category: 'Refund Pembelian', description: `Void PO ${po.supplier_name}`, ref_id: po.id, created_at: serverTimestamp() });
                    if(financeConfig?.defaultInventoryId) t.update(doc(db, "chart_of_accounts", financeConfig.defaultInventoryId), { balance: increment(-po.total_amount) });
                }
                t.delete(doc(db, "purchase_orders", po.id));
            });

            invalidateSmart('PURCHASE');
            fetchHistory(true);
            toast.success("PO Dihapus", { id: tId });
        } catch (e) { toast.error("Gagal menghapus: " + e.message, { id: tId }); }
    };

    // ... (executeBatchPay same logic with invalidateSmart('PURCHASE') ...)
    const executeBatchPay = async (walletId) => {
        const tId = toast.loading("Processing...");
        try {
            const q = query(collection(db, "purchase_orders"), where("payment_status", "==", "unpaid"));
            const snap = await getDocs(q);
            if(snap.empty) { toast.dismiss(tId); return toast("Semua PO Lunas"); }
            const batch = writeBatch(db);
            let totalPaid = 0;
            snap.forEach(d => {
                const po = d.data();
                batch.update(doc(db, "purchase_orders", d.id), { payment_status: 'paid', amount_paid: po.total_amount, updated_at: serverTimestamp(), updated_by: 'BATCH_PAY' });
                if(po.total_amount > 0) {
                    recordTransaction(db, batch, { type: 'out', amount: po.total_amount, walletId, categoryId: financeConfig.defaultPayableId || '2101', categoryName: 'Pelunasan Hutang Usaha', description: `Batch Pay PO`, refType: 'purchase_payment', refId: d.id, userEmail: user?.email });
                    totalPaid += po.total_amount;
                }
            });
            await batch.commit();
            invalidateSmart('PURCHASE'); 
            fetchHistory(true); setDevModalOpen(false);
            toast.success(`Paid: ${formatRupiah(totalPaid)}`, { id: tId });
        } catch(e) { toast.error(e.message, { id: tId }); }
    };

    const filteredHistory = history.filter(h => h.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) || h.id.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            <PageHeader title="Purchase Orders" subtitle="Kelola pembelian stok dari supplier." actions={
                <div className="flex gap-3">
                    <button onClick={() => setDevModalOpen(true)} className="hidden md:flex btn-ghost-dark px-3 py-2 items-center gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" title="Dev Tool"><Zap className="w-4 h-4"/> Pay All (Dev)</button>
                    <Link href="/purchases/import" className="hidden sm:flex btn-ghost-dark px-4 py-2 items-center gap-2"><FileText className="w-4 h-4"/> Import</Link>
                    <button onClick={() => { setEditingPO(null); setModalOpen(true); }} className="btn-gold flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4 stroke-[3px]" /> New PO</button>
                </div>
            }/>
            <div className="relative group">
                <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3 group-focus-within:text-primary transition-colors" />
                <input className="w-full pl-10 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:border-primary" placeholder="Cari Supplier / Order ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <PurchaseTable history={filteredHistory} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />
            <Portal>
                <PurchaseOrderForm isOpen={modalOpen} onClose={()=>setModalOpen(false)} onSubmit={handleSubmitPO} suppliers={suppliers} warehouses={warehouses} products={products} variants={variants} wallets={wallets} initialData={editingPO} isEditing={!!editingPO} />
                <BatchPaymentModal isOpen={devModalOpen} onClose={()=>setDevModalOpen(false)} onExecute={executeBatchPay} wallets={wallets} />
            </Portal>
        </div>
    );
}