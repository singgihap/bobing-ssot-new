// app/supplier-sessions/page.js
"use client";
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { sortBySize } from '@/lib/utils';
import Sortable from 'sortablejs';

export default function VirtualStockPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [variants, setVariants] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [visibleProducts, setVisibleProducts] = useState([]);
    const gridRef = useRef(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentModalProd, setCurrentModalProd] = useState(null);
    const [modalUpdates, setModalUpdates] = useState({});

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (gridRef.current && visibleProducts.length > 0) {
            new Sortable(gridRef.current, { animation: 150, ghostClass: 'opacity-50' });
        }
    }, [visibleProducts]);

    const fetchData = async () => {
        try {
            const [sSupp, sWh, sProd, sVar, sSnap] = await Promise.all([
                getDocs(query(collection(db, "suppliers"), orderBy("name"))),
                getDocs(collection(db, "warehouses")),
                getDocs(collection(db, "products")),
                getDocs(query(collection(db, "product_variants"), orderBy("sku"))),
                getDocs(collection(db, "stock_snapshots"))
            ]);
            // ... (Logic fetch sama seperti sebelumnya) ...
            const supps = []; sSupp.forEach(d => supps.push({id: d.id, ...d.data()})); setSuppliers(supps);
            const whs = []; sWh.forEach(d => whs.push({id: d.id, ...d.data()})); setWarehouses(whs);
            const prods = []; sProd.forEach(d => prods.push({id: d.id, ...d.data()})); setProducts(prods);
            const vars = []; sVar.forEach(d => vars.push({id: d.id, ...d.data()})); setVariants(vars);
            const snaps = {}; sSnap.forEach(d => snaps[d.id] = d.data()); setSnapshots(snaps);
        } catch (e) { console.error(e); }
    };

    const handleSupplierChange = (e) => {
        const suppId = e.target.value;
        setSelectedSupplierId(suppId);
        if (!suppId) { setVisibleProducts([]); return; }
        const wh = warehouses.find(w => w.type === 'virtual_supplier' && w.supplier_id === suppId);
        if (!wh) { alert("Supplier ini belum punya Gudang Virtual."); return; }

        const grouped = {};
        variants.forEach(v => {
            if (!grouped[v.product_id]) {
                const p = products.find(x => x.id === v.product_id);
                if(p) grouped[v.product_id] = { ...p, variants: [], totalStock: 0 };
            }
            if(grouped[v.product_id]) {
                grouped[v.product_id].variants.push(v);
                grouped[v.product_id].totalStock += (snapshots[`${v.id}_${wh.id}`]?.qty || 0);
            }
        });
        setVisibleProducts(Object.values(grouped).sort((a,b) => (a.base_sku||'').localeCompare(b.base_sku||'')));
    };

    const openModal = (prod) => {
        setCurrentModalProd(prod); setModalUpdates({}); setModalOpen(true);
    };

    const saveModal = async () => {
        const wh = warehouses.find(w => w.type === 'virtual_supplier' && w.supplier_id === selectedSupplierId);
        const updates = [];
        Object.keys(modalUpdates).forEach(vid => {
            const real = parseInt(modalUpdates[vid]);
            const current = snapshots[`${vid}_${wh.id}`]?.qty || 0;
            if (!isNaN(real) && real !== current) updates.push({ variantId: vid, real, diff: real - current });
        });
        if(updates.length === 0) { setModalOpen(false); return; }

        try {
            await runTransaction(db, async (t) => {
                const sessRef = doc(collection(db, "supplier_stock_sessions"));
                t.set(sessRef, { supplier_id: selectedSupplierId, warehouse_id: wh.id, date: serverTimestamp(), created_by: auth.currentUser?.email, type: 'overwrite' });
                for(const up of updates) {
                    const k = `${up.variantId}_${wh.id}`;
                    const snapRef = doc(db, "stock_snapshots", k);
                    const sDoc = await t.get(snapRef);
                    t.set(doc(collection(db, "stock_movements")), { variant_id: up.variantId, warehouse_id: wh.id, type: 'supplier_sync', qty: up.diff, ref_id: sessRef.id, ref_type: 'supplier_session', date: serverTimestamp() });
                    if(sDoc.exists()) t.update(snapRef, { qty: up.real, updated_at: serverTimestamp() });
                    else t.set(snapRef, { id: k, variant_id: up.variantId, warehouse_id: wh.id, qty: up.real, updated_at: serverTimestamp() });
                }
            });
            alert("Stok terupdate!"); setModalOpen(false); fetchData();
        } catch(e) { alert(e.message); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            <div className="card flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Virtual Stock Map</h2>
                    <p className="text-sm text-gray-500">Visual stock management for supplier inventory.</p>
                </div>
                <select className="select-field w-64 font-medium" value={selectedSupplierId} onChange={handleSupplierChange}>
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {selectedSupplierId && (
                <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {visibleProducts.map(p => (
                        <div key={p.id} className="card p-5 cursor-grab active:cursor-grabbing hover:shadow-lg hover:border-brand-200 relative group" onClick={() => openModal(p)}>
                            <span className="text-[10px] font-bold bg-brand-50 text-brand-600 px-2 py-1 rounded uppercase tracking-wide border border-brand-100">{p.base_sku}</span>
                            <h3 className="text-sm font-bold text-gray-800 mt-2 mb-4 line-clamp-2 h-10">{p.name}</h3>
                            <div className="flex justify-between items-end border-t border-gray-100 pt-3">
                                <span className="text-xs text-gray-400 font-medium">{p.variants.length} Items</span>
                                <span className="text-lg font-bold text-emerald-600">{p.totalStock}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && currentModalProd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col fade-in-up">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">{currentModalProd.name}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-2xl text-gray-400">&times;</button>
                        </div>
                        <div className="overflow-auto p-0">
                            <table className="table-modern">
                                <thead><tr><th className="pl-6">Varian</th><th className="text-center">System</th><th className="text-center w-32 bg-brand-50">Real</th></tr></thead>
                                <tbody>
                                    {currentModalProd.variants.sort(sortBySize).map(v => {
                                        const whId = warehouses.find(w => w.supplier_id === selectedSupplierId)?.id;
                                        const qty = snapshots[`${v.id}_${whId}`]?.qty || 0;
                                        return (
                                            <tr key={v.id}>
                                                <td className="pl-6 font-medium">{v.color} / {v.size} <span className="text-xs font-mono text-gray-400 ml-2">{v.sku}</span></td>
                                                <td className="text-center font-mono text-gray-500">{qty}</td>
                                                <td className="bg-brand-50/30 p-2">
                                                    <input type="number" className="w-full text-center border-brand-200 rounded-lg py-1.5 font-bold text-brand-700 focus:ring-brand-500" placeholder={qty}
                                                        onChange={(e) => setModalUpdates({...modalUpdates, [v.id]: e.target.value})} />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end">
                            <button onClick={saveModal} className="btn-primary">Update Stock</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}