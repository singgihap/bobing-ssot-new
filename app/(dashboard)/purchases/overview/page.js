// app/(dashboard)/purchases/overview/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { usePurchaseCart } from '@/context/PurchaseCartContext'; // --- INTEGRASI 1: Import Context ---
import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE ---
const CACHE_KEY_HISTORY = 'lumina_purchases_history_v2';
const CACHE_KEY_MASTER = 'lumina_purchases_master_v2'; 
const CACHE_DURATION_MASTER = 30 * 60 * 1000; 
const CACHE_DURATION_HISTORY = 5 * 60 * 1000; 

// Cache Keys External
const CACHE_KEY_PRODUCTS = 'lumina_products_data_v2';
const CACHE_KEY_VARIANTS = 'lumina_variants_v2';

export default function PurchasesPage() {
    const { user } = useAuth();
    
    // --- INTEGRASI 2: Ambil Data Cart Global ---
    const { cart: globalCart, clearCart } = usePurchaseCart();
    
    // Data State
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Master Data State
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [variants, setVariants] = useState([]);
    
    // UI/Form State
    const [modalOpen, setModalOpen] = useState(false);
    const [cart, setCart] = useState([]); // Local cart untuk manipulasi di modal
    
    const [formData, setFormData] = useState({ 
        supplier_id: '', 
        warehouse_id: '', 
        date: '', 
        notes: '' 
    });
    
    const [inputItem, setInputItem] = useState({ variant_id: '', qty: '', cost: '' });

    // Helper: Invalidate Cache
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(CACHE_KEY_HISTORY); 
    };

    useEffect(() => { 
        fetchHistory(); 
        fetchMasterData(); 
    }, []);

    // --- FETCHING LOGIC (Sama seperti sebelumnya) ---
    const fetchHistory = async (forceRefresh = false) => {
        setLoading(true);
        try {
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY_HISTORY);
                if (cached) {
                    const { data, ts } = JSON.parse(cached);
                    if (Date.now() - ts < CACHE_DURATION_HISTORY) {
                        const revived = data.map(d => ({ ...d, order_date: new Date(d.order_date) }));
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
                data.push({ id: d.id, ...docData, order_date: docData.order_date.toDate() });
            });
            
            setHistory(data);

            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY_HISTORY, JSON.stringify({ data: data, ts: Date.now() }));
            }
        } catch (e) { 
            console.error(e);
            toast.error("Gagal memuat riwayat PO");
        } finally { 
            setLoading(false); 
        }
    };

    const fetchMasterData = async () => {
        // ... (Logika fetch master data tetap sama untuk menghemat baris di sini) ...
        // Pastikan Anda menyalin logika fetchMasterData yang sudah ada sebelumnya
        // atau gunakan yang dari file sebelumnya karena tidak ada perubahan di sini.
        try {
            if (typeof window === 'undefined') return;
            // (Logika Caching Master Data standard...)
            // Agar ringkas, saya asumsikan fungsi ini ada dan sama persis.
            // Jika butuh saya tulis ulang, kabari saja.
            
            // Implementasi singkat untuk kelengkapan file:
            let whList = [], suppList = [];
            const cachedMaster = localStorage.getItem(CACHE_KEY_MASTER);
            if(cachedMaster) {
                const p = JSON.parse(cachedMaster);
                if(Date.now()-p.ts < CACHE_DURATION_MASTER) { whList=p.warehouses; suppList=p.suppliers; }
            }
            if(whList.length===0) {
                 const sWh = await getDocs(query(collection(db, "warehouses"), orderBy("created_at")));
                 sWh.forEach(d => { if(d.data().type==='physical' || !d.data().type) whList.push({id:d.id, ...d.data()}) });
                 const sSupp = await getDocs(query(collection(db, "suppliers"), orderBy("name")));
                 sSupp.forEach(d => suppList.push({id:d.id, ...d.data()}));
                 localStorage.setItem(CACHE_KEY_MASTER, JSON.stringify({ warehouses: whList, suppliers: suppList, ts: Date.now() }));
            }
            setWarehouses(whList);
            setSuppliers(suppList);
            
            // Fetch Products/Variants untuk dropdown manual
            const cachedVar = localStorage.getItem(CACHE_KEY_VARIANTS);
            const cachedProd = localStorage.getItem(CACHE_KEY_PRODUCTS);
            let vData = [], pData = [];
            
            if(cachedVar) { vData = JSON.parse(cachedVar).data || []; }
            else { 
                const s = await getDocs(query(collection(db, "product_variants"), orderBy("sku")));
                s.forEach(d=>vData.push({id:d.id,...d.data()}));
            }
            if(cachedProd) { pData = JSON.parse(cachedProd).products || []; }
            else {
                const s = await getDocs(collection(db, "products"));
                s.forEach(d=>pData.push({id:d.id,...d.data()}));
            }
            
            setVariants(vData);
            setProducts(pData);
        } catch(e) { console.error(e); }
    };

    // --- INTEGRASI 3: Handler Buka Modal dengan Data Cart ---
    const handleNewPO = () => {
        // Reset Form
        setFormData({ 
            supplier_id: '', 
            warehouse_id: '', 
            date: new Date().toISOString().split('T')[0], 
            notes: '' 
        });

        // Cek Global Cart
        if (globalCart.length > 0) {
            // Masukkan data dari Inventory ke Form Cart
            // Pastikan struktur datanya cocok
            const mappedCart = globalCart.map(item => ({
                variant_id: item.variant_id,
                sku: item.sku,
                name: item.name,
                spec: item.spec || '-',
                qty: item.qty > 0 ? item.qty : 1, // Default 1 jika user belum isi qty di inventory
                unit_cost: item.unit_cost || 0
            }));
            
            setCart(mappedCart);
            toast.success(`${mappedCart.length} Item dimuat dari Draft!`, { icon: '🚀' });
        } else {
            setCart([]);
        }
        
        setModalOpen(true);
    };

    const addItem = () => {
        const { variant_id, qty, cost } = inputItem;
        if(!variant_id || !qty || !cost) return toast.error("Lengkapi data item");
        const v = variants.find(x => x.id === variant_id);
        const p = products.find(x => x.id === v.product_id);
        
        const existingIdx = cart.findIndex(c => c.variant_id === variant_id);
        if(existingIdx >= 0) {
            const newCart = [...cart];
            newCart[existingIdx].qty += parseInt(qty);
            setCart(newCart);
        } else {
            setCart([...cart, { 
                variant_id, 
                sku: v.sku, 
                name: p?.name, 
                spec: `${v.color}/${v.size}`, 
                qty: parseInt(qty), 
                unit_cost: parseInt(cost) 
            }]);
        }
        setInputItem({ variant_id: '', qty: '', cost: '' });
    };

    const removeItem = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const submitPO = async (e) => {
        e.preventDefault();
        if(cart.length === 0) return toast.error("Keranjang kosong");
        
        const toastId = toast.loading("Menyimpan PO...");
        try {
            const totalAmount = cart.reduce((a,b) => a + (b.qty * b.unit_cost), 0);
            const totalQty = cart.reduce((a,b) => a + b.qty, 0);
            const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name;
            
            await runTransaction(db, async (t) => {
                const poRef = doc(collection(db, "purchase_orders"));
                
                // HEADER PO (Status OPEN, belum stok masuk)
                t.set(poRef, { 
                    po_number: `PO-${Date.now()}`,
                    supplier_id: formData.supplier_id, 
                    supplier_name: supplierName,
                    warehouse_id: formData.warehouse_id, 
                    order_date: new Date(formData.date), 
                    
                    fulfillment_status: 'OPEN', 
                    payment_status: 'UNPAID',
                    
                    total_amount: totalAmount, 
                    total_qty: totalQty, 
                    amount_paid: 0, 
                    
                    notes: formData.notes,
                    created_at: serverTimestamp(), 
                    created_by: user?.email 
                });
                
                // ITEMS
                for(const i of cart) {
                    t.set(doc(collection(db, `purchase_orders/${poRef.id}/items`)), { 
                        variant_id: i.variant_id, 
                        name: i.name,
                        sku: i.sku,
                        qty_ordered: i.qty,
                        qty_received: 0,
                        unit_cost: i.unit_cost, 
                        subtotal: i.qty * i.unit_cost 
                    });
                }
            });

            // --- INTEGRASI 4: Bersihkan Global Cart ---
            // Karena sudah jadi PO, draft di inventory dihapus
            if (globalCart.length > 0) {
                clearCart(); 
            }

            invalidateRelatedCaches();
            toast.success("PO Berhasil Dibuat", { id: toastId });
            setModalOpen(false); 
            fetchHistory(true); 
            setCart([]);
            
        } catch(e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl md:text-3xl font-display font-bold text-text-primary tracking-tight">Purchase Orders</h2>
                    <p className="text-sm text-text-secondary">Manage orders and incoming stock.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/purchases/import" className="btn-ghost-dark">Import</Link>
                    
                    {/* --- INTEGRASI 5: Tombol Indikator Cart --- */}
                    <button
                        onClick={handleNewPO}
                        className={`btn-gold flex items-center gap-2 ${globalCart.length > 0 ? 'animate-pulse ring-2 ring-white' : ''}`}
                    >
                        {globalCart.length > 0 ? (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                                <span>Finalize Draft ({globalCart.length})</span>
                            </>
                        ) : (
                            "New PO"
                        )}
                    </button>
                </div>
            </div>

            {/* Table Wrapper */}
            <div className="card-luxury overflow-hidden">
                <div className="table-wrapper-dark overflow-x-auto">
                    <table className="table-dark w-full min-w-full">
                        <thead>
                            <tr>
                                <th className="pl-6">Date</th>
                                <th>Supplier</th>
                                <th className="text-right">Total</th>
                                <th className="text-center">Status Barang</th>
                                <th className="text-center">Status Bayar</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-text-secondary animate-pulse">Loading History...</td></tr>
                            ) : history.map(h => (
                                <tr key={h.id}>
                                    <td className="pl-6 font-mono text-xs text-text-secondary">{new Date(h.order_date).toLocaleDateString()}</td>
                                    <td className="text-text-primary font-medium">
                                        {h.supplier_name}
                                        <span className="block text-[10px] text-text-secondary">{h.po_number || 'ID:'+h.id.substr(0,8)}</span>
                                    </td>
                                    <td className="text-right font-bold text-lumina-gold">{formatRupiah(h.total_amount)}</td>
                                    <td className="text-center">
                                        <span className={`badge-luxury ${h.fulfillment_status === 'RECEIVED' ? 'badge-success' : 'bg-blue-900 text-blue-200'}`}>
                                            {h.fulfillment_status || 'OPEN'}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        <span className={`badge-luxury ${h.payment_status === 'PAID' ? 'badge-success' : h.payment_status === 'PARTIAL_PAID' ? 'bg-amber-900 text-amber-200' : 'bg-rose-900 text-rose-200'}`}>
                                            {h.payment_status || 'UNPAID'}
                                        </span>
                                    </td>
                                    <td className="text-right pr-6">
                                        <Link href={`/purchases/${h.id}`} className="text-xs font-bold text-lumina-gold hover:underline">
                                            Manage &rarr;
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Portal>
                {/* Modal Create PO */}
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4">
                        <div className="card-luxury w-full max-w-4xl p-6 fade-in-up max-h-[90vh] overflow-y-auto flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-text-primary">
                                    {globalCart.length > 0 && cart.length > 0 ? "Finalize Draft PO" : "Create New Purchase Order"}
                                </h3>
                                <button onClick={() => setModalOpen(false)} className="text-2xl text-text-secondary hover:text-text-primary">×</button>
                            </div>
                            
                            {/* Alert jika load dari draft */}
                            {globalCart.length > 0 && cart.length > 0 && (
                                <div className="mb-4 bg-blue-900/30 border border-blue-800 text-blue-200 text-xs p-3 rounded-lg flex items-center gap-2">
                                    <span>ℹ️</span>
                                    <span>Data dimuat dari Inventory Draft. Silakan lengkapi Supplier, Gudang, dan harga beli (Cost).</span>
                                </div>
                            )}
                            
                            <form onSubmit={submitPO} className="space-y-4 flex-1 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary mb-1">Supplier</label>
                                        <select required className="input-luxury" value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                                            <option value="">-- Select --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary mb-1">Target Warehouse</label>
                                        <select required className="input-luxury" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
                                            <option value="">-- Select --</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary mb-1">Order Date</label>
                                        <input type="date" required className="input-luxury" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                    </div>
                                </div>
                                
                                {/* Manual Add Item (Jika ingin tambah barang lain selain dari draft) */}
                                <div className="bg-background p-4 rounded-xl border border-lumina-border">
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                        <div className="sm:col-span-6">
                                            <label className="text-xs font-bold text-text-secondary mb-1 block">Add More Items</label>
                                            <select className="input-luxury w-full" value={inputItem.variant_id} onChange={e => { const v = variants.find(x=>x.id===e.target.value); setInputItem({...inputItem, variant_id: e.target.value, cost: v?.cost || ''}) }}>
                                                <option value="">Select Variant...</option>
                                                {variants.map(v => { const p = products.find(x=>x.id===v.product_id); return <option key={v.id} value={v.id}>{v.sku} - {p?.name} ({v.color}/{v.size})</option> })}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="text-xs font-bold text-text-secondary mb-1 block">Qty</label>
                                            <input type="number" className="input-luxury w-full" placeholder="0" value={inputItem.qty} onChange={e=>setInputItem({...inputItem, qty:e.target.value})} />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className="text-xs font-bold text-text-secondary mb-1 block">Cost (IDR)</label>
                                            <input type="number" className="input-luxury w-full" placeholder="0" value={inputItem.cost} onChange={e=>setInputItem({...inputItem, cost:e.target.value})} />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <button type="button" onClick={addItem} className="btn-gold w-full p-2.5 mt-2 sm:mt-0">+</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Cart Preview */}
                                <div className="border border-lumina-border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-sm text-left text-text-primary min-w-[400px]">
                                        <thead className="bg-surface text-xs text-text-secondary uppercase sticky top-0">
                                            <tr><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Total</th><th className="p-3"></th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-lumina-border">
                                            {cart.length === 0 ? (
                                                <tr><td colSpan="5" className="p-4 text-center text-text-secondary text-xs italic">No items added yet.</td></tr>
                                            ) : cart.map((c, idx) => (
                                                <tr key={idx} className="group hover:bg-white/5">
                                                    <td className="p-3">
                                                        <div className="font-medium">{c.name}</div>
                                                        <div className="text-xs text-text-secondary">{c.sku} ({c.spec})</div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {/* Editable Qty in Cart */}
                                                        <input 
                                                            type="number" 
                                                            className="bg-transparent text-right border-b border-white/20 w-16 focus:border-lumina-gold focus:outline-none"
                                                            value={c.qty}
                                                            onChange={(e) => {
                                                                const newCart = [...cart];
                                                                newCart[idx].qty = parseInt(e.target.value) || 0;
                                                                setCart(newCart);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {/* Editable Cost in Cart */}
                                                        <input 
                                                            type="number" 
                                                            className="bg-transparent text-right border-b border-white/20 w-24 focus:border-lumina-gold focus:outline-none"
                                                            value={c.unit_cost}
                                                            onChange={(e) => {
                                                                const newCart = [...cart];
                                                                newCart[idx].unit_cost = parseInt(e.target.value) || 0;
                                                                setCart(newCart);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right font-mono">{formatRupiah(c.qty*c.unit_cost)}</td>
                                                    <td className="p-3 text-right">
                                                        <button type="button" onClick={() => removeItem(idx)} className="text-rose-500 hover:text-rose-400 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-surface font-bold text-sm">
                                            <tr>
                                                <td colSpan="3" className="p-3 text-right">Estimated Total</td>
                                                <td className="p-3 text-right text-lumina-gold">
                                                    {formatRupiah(cart.reduce((a,b)=>a+(b.qty*b.unit_cost),0))}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-text-secondary mb-1">Notes</label>
                                    <input className="input-luxury" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Shipping instruction..." />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-lumina-border">
                                    <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                    <button type="submit" className="btn-gold">Create Order</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </Portal>
        </div>
    );
}