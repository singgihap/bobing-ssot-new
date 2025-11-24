"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_KEY_HISTORY = 'lumina_purchases_history_v2';
const CACHE_KEY_MASTER = 'lumina_purchases_master_v2'; // Suppliers & Warehouses
const CACHE_DURATION_MASTER = 30 * 60 * 1000; // 30 Menit
const CACHE_DURATION_HISTORY = 5 * 60 * 1000; // 5 Menit

// Cache Keys dari halaman lain untuk di-reuse
const CACHE_KEY_PRODUCTS = 'lumina_products_data_v2';
const CACHE_KEY_VARIANTS = 'lumina_variants_v2';

export default function PurchasesPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);
    
    // Master Data
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [variants, setVariants] = useState([]);
    
    // Form States
    const [cart, setCart] = useState([]);
    const [formData, setFormData] = useState({ supplier_id: '', warehouse_id: '', date: '', isPaid: false });
    const [inputItem, setInputItem] = useState({ variant_id: '', qty: '', cost: '' });
    const [poItems, setPoItems] = useState([]);

    // Helper: Invalidate Cache Relevan
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(CACHE_KEY_HISTORY); // Refresh list PO
        localStorage.removeItem('lumina_inventory_v2'); // Refresh Inventory (Stok nambah)
        localStorage.removeItem('lumina_pos_snapshots_v2'); // Refresh POS Stock
        localStorage.removeItem('lumina_dash_master_v2'); // Refresh Dashboard (Cash/Asset)
    };

    useEffect(() => { 
        fetchHistory(); 
        fetchMasterData(); 
    }, []);

    // 1. Fetch History (Optimized with LocalStorage & Limit)
    const fetchHistory = async (forceRefresh = false) => {
        setLoading(true);
        try {
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY_HISTORY);
                if (cached) {
                    const { data, ts } = JSON.parse(cached);
                    if (Date.now() - ts < CACHE_DURATION_HISTORY) {
                        const revived = data.map(d => ({
                            ...d,
                            order_date: new Date(d.order_date)
                        }));
                        setHistory(revived);
                        setLoading(false);
                        return;
                    }
                }
            }

            const q = query(collection(db, "purchase_orders"), orderBy("order_date", "desc"), limit(50));
            const snap = await getDocs(q);
            const data = []; 
            snap.forEach(d => {
                const docData = d.data();
                data.push({
                    id: d.id, 
                    ...docData,
                    order_date: docData.order_date.toDate()
                });
            });
            
            setHistory(data);

            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY_HISTORY, JSON.stringify({
                    data: data,
                    ts: Date.now()
                }));
            }

        } catch (e) { 
            console.error(e);
            toast.error("Gagal memuat riwayat PO");
        } finally { 
            setLoading(false); 
        }
    };

    // 2. Fetch Master Data (Smart Reuse Strategy)
    const fetchMasterData = async () => {
        try {
            if (typeof window === 'undefined') return;

            // A. Load Suppliers & Warehouses (Own Cache)
            let whList = [], suppList = [];
            let needFetchMaster = true;

            const cachedMaster = localStorage.getItem(CACHE_KEY_MASTER);
            if (cachedMaster) {
                const parsed = JSON.parse(cachedMaster);
                if (Date.now() - parsed.ts < CACHE_DURATION_MASTER) {
                    whList = parsed.warehouses;
                    suppList = parsed.suppliers;
                    needFetchMaster = false;
                }
            }

            // B. Load Products & Variants (Reuse External Cache)
            let prodList = [], varList = [];
            let needFetchProd = true;
            let needFetchVar = true;

            const rawProd = localStorage.getItem(CACHE_KEY_PRODUCTS);
            const rawVar = localStorage.getItem(CACHE_KEY_VARIANTS);

            if (rawProd) {
                const parsed = JSON.parse(rawProd);
                // Support struktur { products: [] } atau []
                const pData = Array.isArray(parsed) ? parsed : (parsed.products || []);
                if (pData.length > 0) {
                    prodList = pData;
                    needFetchProd = false;
                }
            }

            if (rawVar) {
                const parsed = JSON.parse(rawVar);
                const vData = parsed.data || []; // Asumsi struktur { data: [], ts: ... }
                if (vData.length > 0) {
                    varList = vData;
                    needFetchVar = false;
                }
            }

            // C. Fetch yang kurang saja
            const promises = [];
            if (needFetchMaster) {
                promises.push(getDocs(query(collection(db, "warehouses"), orderBy("created_at"))));
                promises.push(getDocs(query(collection(db, "suppliers"), orderBy("name"))));
            }
            if (needFetchProd) promises.push(getDocs(collection(db, "products")));
            if (needFetchVar) promises.push(getDocs(query(collection(db, "product_variants"), orderBy("sku"))));

            if (promises.length > 0) {
                const results = await Promise.all(promises);
                let idx = 0;

                if (needFetchMaster) {
                    const sWh = results[idx++];
                    const sSupp = results[idx++];
                    whList = []; sWh.forEach(d => { if(d.data().type==='physical' || !d.data().type) whList.push({id:d.id, ...d.data()}) });
                    suppList = []; sSupp.forEach(d => suppList.push({id:d.id, ...d.data()}));
                    
                    // Simpan Cache Master Sendiri
                    localStorage.setItem(CACHE_KEY_MASTER, JSON.stringify({ warehouses: whList, suppliers: suppList, ts: Date.now() }));
                }

                if (needFetchProd) {
                    const sProd = results[idx++];
                    prodList = []; sProd.forEach(d => prodList.push({id:d.id, ...d.data()}));
                    // Opsional: Simpan ke cache products v2 jika kosong (side effect positif)
                    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify({ products: prodList, timestamp: Date.now() }));
                }

                if (needFetchVar) {
                    const sVar = results[idx++];
                    varList = []; sVar.forEach(d => varList.push({id:d.id, ...d.data()}));
                    // Opsional: Simpan ke cache variants v2
                    localStorage.setItem(CACHE_KEY_VARIANTS, JSON.stringify({ data: varList, timestamp: Date.now() }));
                }
            }

            setWarehouses(whList);
            setSuppliers(suppList);
            setProducts(prodList);
            setVariants(varList);

        } catch(e) { 
            console.error(e); 
            toast.error("Gagal memuat data master");
        }
    };

    const addItem = () => {
        const { variant_id, qty, cost } = inputItem;
        if(!variant_id || !qty || !cost) return toast.error("Lengkapi data item");
        const v = variants.find(x => x.id === variant_id);
        const p = products.find(x => x.id === v.product_id);
        setCart([...cart, { variant_id, sku: v.sku, name: p?.name, spec: `${v.color}/${v.size}`, qty: parseInt(qty), unit_cost: parseInt(cost) }]);
        setInputItem({ variant_id: '', qty: '', cost: '' });
    };

    const submitPO = async (e) => {
        e.preventDefault();
        if(cart.length === 0) return toast.error("Keranjang kosong");
        
        const toastId = toast.loading("Memproses PO...");
        try {
            const totalAmount = cart.reduce((a,b) => a + (b.qty * b.unit_cost), 0);
            const totalQty = cart.reduce((a,b) => a + b.qty, 0);
            const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name;
            
            await runTransaction(db, async (t) => {
                const poRef = doc(collection(db, "purchase_orders"));
                t.set(poRef, { 
                    supplier_name: supplierName, warehouse_id: formData.warehouse_id, 
                    order_date: new Date(formData.date), status: 'received_full', 
                    total_amount: totalAmount, total_qty: totalQty, 
                    payment_status: formData.isPaid ? 'paid' : 'unpaid', 
                    created_at: serverTimestamp(), created_by: user?.email 
                });
                
                for(const i of cart) {
                    // PO Items
                    t.set(doc(collection(db, `purchase_orders/${poRef.id}/items`)), { 
                        variant_id: i.variant_id, qty: i.qty, unit_cost: i.unit_cost, subtotal: i.qty*i.unit_cost 
                    });
                    
                    // Stock Movement
                    t.set(doc(collection(db, "stock_movements")), { 
                        variant_id: i.variant_id, warehouse_id: formData.warehouse_id, type: 'purchase_in', 
                        qty: i.qty, unit_cost: i.unit_cost, ref_id: poRef.id, ref_type: 'purchase_order', 
                        date: serverTimestamp(), notes: `PO ${supplierName}` 
                    });
                    
                    // Update Snapshot (Composite ID)
                    const snapshotId = `${i.variant_id}_${formData.warehouse_id}`;
                    const sRef = doc(db, "stock_snapshots", snapshotId); 
                    const sDoc = await t.get(sRef);
                    
                    if(sDoc.exists()) {
                        t.update(sRef, { qty: (sDoc.data().qty||0) + i.qty });
                    } else {
                        t.set(sRef, { id: snapshotId, variant_id: i.variant_id, warehouse_id: formData.warehouse_id, qty: i.qty });
                    }
                }
                
                if(formData.isPaid) {
                    const cashRef = doc(collection(db, "cash_transactions"));
                    t.set(cashRef, { 
                        type: 'out', amount: totalAmount, date: serverTimestamp(), 
                        ref_type: 'purchase_order', ref_id: poRef.id, 
                        category: 'pembelian', description: `Bayar PO ${supplierName}` 
                    });
                }
            });

            invalidateRelatedCaches();
            
            toast.success("PO Berhasil Disimpan!", { id: toastId });
            setModalOpen(false); 
            fetchHistory(true); // Force refresh list
            setCart([]);
            
        } catch(e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    const openDetail = async (po) => {
        setSelectedPO(po); 
        setDetailOpen(true);
        setPoItems([]); // Reset prev
        try {
            const itemsSnap = await getDocs(collection(db, `purchase_orders/${po.id}/items`));
            const items = []; 
            itemsSnap.forEach(d => { 
                const i = d.data(); 
                const v = variants.find(x => x.id === i.variant_id); 
                const p = v ? products.find(x => x.id === v.product_id) : null; 
                items.push({ ...i, name: p?.name, sku: v?.sku }); 
            });
            setPoItems(items);
        } catch(e) {
            toast.error("Gagal memuat detail");
        }
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center">
            <div>
                <h2 className="text-xl md:text-3xl font-display font-bold text-lumina-text tracking-tight">Purchase Orders</h2>
                <p className="text-sm text-lumina-muted">Manage supplier orders.</p>
            </div>
            <div className="flex gap-2">
                <Link href="/purchases-import" className="btn-ghost-dark">Import</Link>
                <button
                onClick={() => { setFormData({ supplier_id:'', warehouse_id:'', date: new Date().toISOString().split('T')[0], isPaid: false}); setCart([]); setModalOpen(true); }}
                className="btn-gold"
                >
                New PO
                </button>
            </div>
            </div>


            <div className="card-luxury overflow-hidden">
                <div className="table-wrapper-dark">
                    <table className="table-dark">
                        <thead>
                            <tr>
                                <th className="pl-6">Date</th>
                                <th>Supplier</th>
                                <th className="text-right">Total</th>
                                <th className="text-center">Status</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-lumina-muted animate-pulse">Loading History...</td></tr>
                            ) : history.map(h => (
                                <tr key={h.id}>
                                    <td className="pl-6 font-mono text-xs text-lumina-muted">{new Date(h.order_date).toLocaleDateString()}</td>
                                    <td className="text-lumina-text font-medium">{h.supplier_name}</td>
                                    <td className="text-right font-bold text-lumina-gold">{formatRupiah(h.total_amount)}</td>
                                    <td className="text-center"><span className={`badge-luxury ${h.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{h.payment_status}</span></td>
                                    <td className="text-right pr-6"><button onClick={() => openDetail(h)} className="text-xs font-bold text-lumina-muted hover:text-lumina-gold">Detail</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Portal>
                {/* Modal PO */}
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="card-luxury w-full max-w-4xl p-6 fade-in-up max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg font-bold text-lumina-text mb-4">New Purchase Order</h3>
                            <form onSubmit={submitPO} className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <select required className="input-luxury" value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                                        <option value="">-- Supplier --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <select required className="input-luxury" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
                                        <option value="">-- Warehouse --</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                    <input type="date" required className="input-luxury" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                </div>
                                
                                <div className="bg-lumina-base p-4 rounded-xl border border-lumina-border">
                                    <div className="grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-6">
                                            <label className="text-xs font-bold text-lumina-muted mb-1 block">Item</label>
                                            <select className="input-luxury" value={inputItem.variant_id} onChange={e => { const v = variants.find(x=>x.id===e.target.value); setInputItem({...inputItem, variant_id: e.target.value, cost: v?.cost || ''}) }}>
                                                <option value="">Select</option>
                                                {variants.map(v => { const p = products.find(x=>x.id===v.product_id); return <option key={v.id} value={v.id}>{v.sku} - {p?.name} ({v.color}/{v.size})</option> })}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-lumina-muted mb-1 block">Qty</label>
                                            <input type="number" className="input-luxury" value={inputItem.qty} onChange={e=>setInputItem({...inputItem, qty:e.target.value})} />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-xs font-bold text-lumina-muted mb-1 block">Cost</label>
                                            <input type="number" className="input-luxury" value={inputItem.cost} onChange={e=>setInputItem({...inputItem, cost:e.target.value})} />
                                        </div>
                                        <div className="col-span-1">
                                            <button type="button" onClick={addItem} className="btn-gold w-full p-2.5">+</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-lumina-border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left text-lumina-text">
                                        <thead className="bg-lumina-surface text-xs text-lumina-muted uppercase">
                                            <tr><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Total</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-lumina-border">
                                            {cart.map((c, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-3">{c.name} <span className="text-xs text-lumina-muted">{c.sku}</span></td>
                                                    <td className="p-3 text-right">{c.qty}</td>
                                                    <td className="p-3 text-right font-mono">{formatRupiah(c.qty*c.unit_cost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex items-center gap-3 bg-amber-900/20 p-3 rounded-xl border border-amber-900/50">
                                    <input type="checkbox" id="isPaid" checked={formData.isPaid} onChange={e => setFormData({...formData, isPaid: e.target.checked})} className="w-5 h-5 accent-lumina-gold" />
                                    <label htmlFor="isPaid" className="text-sm font-bold text-amber-500 cursor-pointer">Paid in Full (Record Expense)</label>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                    <button type="submit" className="btn-gold">Create Order</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Detail */}
                {detailOpen && selectedPO && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="card-luxury w-full max-w-2xl p-6 fade-in-up">
                            <div className="flex justify-between mb-4">
                                <h3 className="text-lg font-bold text-lumina-text">PO Details</h3>
                                <button onClick={()=>setDetailOpen(false)} className="text-lumina-muted">✕</button>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm border-b border-lumina-border pb-3">
                                    <span className="text-lumina-muted">Supplier: <strong className="text-white">{selectedPO.supplier_name}</strong></span>
                                    <span className="text-lumina-muted">Status: <strong className="text-white uppercase">{selectedPO.payment_status}</strong></span>
                                </div>
                                <table className="w-full text-sm text-lumina-text">
                                    <thead className="bg-lumina-base text-lumina-muted">
                                        <tr><th className="p-2 text-left">Product</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Subtotal</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-lumina-border">
                                        {poItems.map((i, idx) => (
                                            <tr key={idx}>
                                                <td className="p-2">{i.name} <span className="text-xs text-lumina-muted block">{i.sku}</span></td>
                                                <td className="p-2 text-right">{i.qty}</td>
                                                <td className="p-2 text-right font-mono">{formatRupiah(i.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-lumina-base font-bold">
                                        <tr><td colSpan="2" className="p-2 text-right">Total</td><td className="p-2 text-right text-lumina-gold">{formatRupiah(selectedPO.total_amount)}</td></tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </Portal>
        </div>
    );
}