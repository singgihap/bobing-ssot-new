// app/purchases/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';

export default function PurchasesPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);
    
    // Master Data & Form
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [variants, setVariants] = useState([]);
    const [cart, setCart] = useState([]);
    const [formData, setFormData] = useState({ supplier_id: '', warehouse_id: '', date: '', isPaid: false });
    const [inputItem, setInputItem] = useState({ variant_id: '', qty: '', cost: '' });
    const [poItems, setPoItems] = useState([]);

    useEffect(() => { fetchHistory(); fetchMasterData(); }, []);

    const fetchHistory = async () => {
        try {
            const q = query(collection(db, "purchase_orders"), orderBy("order_date", "desc"), limit(50));
            const snap = await getDocs(q);
            const data = []; snap.forEach(d => data.push({id: d.id, ...d.data()}));
            setHistory(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchMasterData = async () => {
        // ... (Logika fetch sama, hanya UI yang berubah)
        const [sWh, sSupp, sProd, sVar] = await Promise.all([
            getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
            getDocs(query(collection(db, "suppliers"), orderBy("name"))),
            getDocs(collection(db, "products")),
            getDocs(query(collection(db, "product_variants"), orderBy("sku")))
        ]);
        const wh = []; sWh.forEach(d => { if(d.data().type==='physical' || !d.data().type) wh.push({id:d.id, ...d.data()}) });
        setWarehouses(wh);
        const sup = []; sSupp.forEach(d => sup.push({id:d.id, ...d.data()}));
        setSuppliers(sup);
        const prod = []; sProd.forEach(d => prod.push({id:d.id, ...d.data()}));
        setProducts(prod);
        const vr = []; sVar.forEach(d => vr.push({id:d.id, ...d.data()}));
        setVariants(vr);
    };

    const addItem = () => {
        const { variant_id, qty, cost } = inputItem;
        if(!variant_id || !qty || !cost) return alert("Lengkapi data item");
        const v = variants.find(x => x.id === variant_id);
        const p = products.find(x => x.id === v.product_id);
        setCart([...cart, { variant_id, sku: v.sku, name: p?.name || 'Unknown', spec: `${v.color}/${v.size}`, qty: parseInt(qty), unit_cost: parseInt(cost) }]);
        setInputItem({ variant_id: '', qty: '', cost: '' });
    };

    const submitPO = async (e) => {
        e.preventDefault();
        if(cart.length === 0) return alert("Keranjang kosong");
        try {
            const totalAmount = cart.reduce((a,b) => a + (b.qty * b.unit_cost), 0);
            const totalQty = cart.reduce((a,b) => a + b.qty, 0);
            const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name;

            await runTransaction(db, async (t) => {
                const poRef = doc(collection(db, "purchase_orders"));
                t.set(poRef, {
                    supplier_name: supplierName, warehouse_id: formData.warehouse_id, order_date: new Date(formData.date),
                    status: 'received_full', total_amount: totalAmount, total_qty: totalQty, payment_status: formData.isPaid ? 'paid' : 'unpaid',
                    created_at: serverTimestamp(), created_by: user?.email
                });
                for(const item of cart) {
                    t.set(doc(collection(db, `purchase_orders/${poRef.id}/items`)), { variant_id: item.variant_id, qty: item.qty, unit_cost: item.unit_cost, subtotal: item.qty*item.unit_cost });
                    t.set(doc(collection(db, "stock_movements")), { variant_id: item.variant_id, warehouse_id: formData.warehouse_id, type: 'purchase_in', qty: item.qty, unit_cost: item.unit_cost, ref_id: poRef.id, ref_type: 'purchase_order', date: serverTimestamp(), notes: `PO ${supplierName}` });
                    const snapRef = doc(db, "stock_snapshots", `${item.variant_id}_${formData.warehouse_id}`);
                    const snapDoc = await t.get(snapRef);
                    if(snapDoc.exists()) t.update(snapRef, { qty: (snapDoc.data().qty||0) + item.qty }); else t.set(snapRef, { id: snapRef.id, variant_id: item.variant_id, warehouse_id: formData.warehouse_id, qty: item.qty });
                }
                if(formData.isPaid) {
                    const cashRef = doc(collection(db, "cash_transactions"));
                    t.set(cashRef, { type: 'out', amount: totalAmount, date: serverTimestamp(), ref_type: 'purchase_order', ref_id: poRef.id, category: 'pembelian', description: `Bayar PO ${supplierName}` });
                }
            });
            alert("Sukses!"); setModalOpen(false); fetchHistory();
        } catch(e) { alert(e.message); }
    };

    const openDetail = async (po) => {
        setSelectedPO(po); setDetailOpen(true);
        const itemsSnap = await getDocs(collection(db, `purchase_orders/${po.id}/items`));
        const items = []; 
        itemsSnap.forEach(d => {
            const i = d.data();
            const v = variants.find(x => x.id === i.variant_id);
            const p = v ? products.find(x => x.id === v.product_id) : null;
            items.push({ ...i, name: p?.name, sku: v?.sku, spec: v ? `${v.color}/${v.size}` : '' });
        });
        setPoItems(items);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage supplier orders and stock intake.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/purchases-import" className="btn-secondary">Import Excel</Link>
                    <button onClick={() => { setFormData({supplier_id:'', warehouse_id:'', date: new Date().toISOString().split('T')[0], isPaid: false}); setCart([]); setModalOpen(true); }} className="btn-primary">New Purchase</button>
                </div>
            </div>

            <div className="card p-0 overflow-hidden">
                <div className="table-wrapper border-0 shadow-none rounded-none">
                    <table className="table-modern">
                        <thead><tr><th className="pl-6">Date</th><th>Supplier</th><th className="text-right">Total</th><th className="text-center">Payment</th><th className="text-right pr-6">Actions</th></tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan="5" className="text-center py-12 text-gray-400">Loading...</td></tr> : history.map(h => (
                                <tr key={h.id}>
                                    <td className="pl-6 font-mono text-gray-600 text-xs">{new Date(h.order_date.toDate()).toLocaleDateString()}</td>
                                    <td className="font-semibold text-gray-800">{h.supplier_name}</td>
                                    <td className="text-right font-bold text-gray-900">{formatRupiah(h.total_amount)}</td>
                                    <td className="text-center">
                                        <span className={`badge ${h.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{h.payment_status}</span>
                                    </td>
                                    <td className="text-right pr-6">
                                        <button onClick={() => openDetail(h)} className="text-xs font-bold text-brand-600 hover:text-brand-800">Detail</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL FORM PO */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 fade-in-up max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">New Purchase Order</h3>
                        <form onSubmit={submitPO} className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <select required className="select-field" value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                                    <option value="">-- Supplier --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <select required className="select-field" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
                                    <option value="">-- Target Warehouse --</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <input type="date" required className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-6">
                                        <label className="text-xs font-bold text-gray-500 mb-1">Product SKU</label>
                                        <select className="select-field" value={inputItem.variant_id} onChange={e => { const v = variants.find(x=>x.id===e.target.value); setInputItem({...inputItem, variant_id: e.target.value, cost: v?.cost || ''}) }}>
                                            <option value="">-- Select Item --</option>
                                            {variants.map(v => { const p = products.find(x=>x.id===v.product_id); return <option key={v.id} value={v.id}>{v.sku} - {p?.name} ({v.color}/{v.size})</option> })}
                                        </select>
                                    </div>
                                    <div className="col-span-2"><label className="text-xs font-bold text-gray-500 mb-1">Qty</label><input type="number" className="input-field" value={inputItem.qty} onChange={e=>setInputItem({...inputItem, qty:e.target.value})} /></div>
                                    <div className="col-span-3"><label className="text-xs font-bold text-gray-500 mb-1">Cost</label><input type="number" className="input-field" value={inputItem.cost} onChange={e=>setInputItem({...inputItem, cost:e.target.value})} /></div>
                                    <div className="col-span-1"><button type="button" onClick={addItem} className="w-full bg-gray-800 text-white p-2.5 rounded-lg font-bold hover:bg-gray-700">+</button></div>
                                </div>
                            </div>

                            <div className="overflow-hidden border border-gray-200 rounded-lg">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Subtotal</th></tr></thead>
                                    <tbody>
                                        {cart.map((c, idx) => (
                                            <tr key={idx} className="border-b border-gray-50"><td className="p-2 font-medium">{c.name} <span className="text-xs text-gray-400 ml-1">{c.sku}</span></td><td className="p-2 text-right">{c.qty}</td><td className="p-2 text-right">{formatRupiah(c.qty*c.unit_cost)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                <input type="checkbox" id="isPaid" checked={formData.isPaid} onChange={e => setFormData({...formData, isPaid: e.target.checked})} className="rounded text-amber-600 focus:ring-amber-500" />
                                <label htmlFor="isPaid" className="text-sm font-bold text-amber-800 cursor-pointer">Paid in Full (Record Cash Out)</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" className="btn-primary">Submit Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DETAIL */}
            {detailOpen && selectedPO && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">PO Details</h3>
                            <button onClick={() => setDetailOpen(false)} className="text-gray-400">&times;</button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm border-b border-gray-100 pb-3">
                                <span className="text-gray-500">Supplier: <strong className="text-gray-900">{selectedPO.supplier_name}</strong></span>
                                <span className="text-gray-500">Status: <strong className="text-gray-900 uppercase">{selectedPO.payment_status}</strong></span>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500"><tr><th className="p-2 text-left">Product</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Subtotal</th></tr></thead>
                                <tbody>
                                    {poItems.map((i, idx) => (
                                        <tr key={idx} className="border-b border-gray-50"><td className="p-2">{i.name} <span className="text-xs text-gray-400 block">{i.sku}</span></td><td className="p-2 text-right">{i.qty}</td><td className="p-2 text-right font-medium">{formatRupiah(i.subtotal)}</td></tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold"><tr><td colSpan="2" className="p-2 text-right">Total Amount</td><td className="p-2 text-right text-brand-600">{formatRupiah(selectedPO.total_amount)}</td></tr></tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}