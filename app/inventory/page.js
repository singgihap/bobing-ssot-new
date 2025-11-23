// app/inventory/page.js
"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, where, serverTimestamp, limit } from 'firebase/firestore';
import { sortBySize } from '@/lib/utils';

export default function InventoryPage() {
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState('sku');
    const [modalDetailOpen, setModalDetailOpen] = useState(false);
    const [modalAdjOpen, setModalAdjOpen] = useState(false);
    const [modalCardOpen, setModalCardOpen] = useState(false);
    
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [adjData, setAdjData] = useState({});
    const [cardData, setCardData] = useState([]);
    const [modalGroup, setModalGroup] = useState('color');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [snapWh, snapProd, snapVar, snapShot] = await Promise.all([
                getDocs(query(collection(db, "warehouses"), orderBy("created_at", "asc"))),
                getDocs(collection(db, "products")),
                getDocs(query(collection(db, "product_variants"), orderBy("sku", "asc"))),
                getDocs(collection(db, "stock_snapshots"))
            ]);

            const whList = []; snapWh.forEach(d => whList.push({id: d.id, ...d.data()}));
            setWarehouses(whList);

            const shots = {}; snapShot.forEach(d => shots[d.id] = d.data().qty || 0);
            setSnapshots(shots);

            const vars = []; snapVar.forEach(d => vars.push({id: d.id, ...d.data()}));
            
            const prodMap = {};
            snapProd.forEach(d => {
                const p = d.data();
                prodMap[d.id] = { id: d.id, ...p, variants: [], totalStock: 0 };
            });

            vars.forEach(v => {
                if (prodMap[v.product_id]) {
                    let total = 0;
                    whList.forEach(w => total += (shots[`${v.id}_${w.id}`] || 0));
                    prodMap[v.product_id].variants.push(v);
                    prodMap[v.product_id].totalStock += total;
                }
            });

            setProducts(Object.values(prodMap));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const openDetail = (prod) => {
        setSelectedProduct(prod);
        setModalDetailOpen(true);
    };

    const openOpname = (v, prodName) => {
        setAdjData({ 
            variantId: v.id, sku: v.sku, productName: prodName, warehouseId: warehouses[0]?.id, 
            currentQty: snapshots[`${v.id}_${warehouses[0]?.id}`] || 0, realQty: '', note: ''
        });
        setModalAdjOpen(true);
    };

    const handleAdjWarehouseChange = (e) => {
        const whId = e.target.value;
        setAdjData(prev => ({ ...prev, warehouseId: whId, currentQty: snapshots[`${prev.variantId}_${whId}`] || 0 }));
    };

    const submitOpname = async (e) => {
        e.preventDefault();
        const diff = parseInt(adjData.realQty) - adjData.currentQty;
        if (isNaN(diff) || diff === 0) { alert("Tidak ada perubahan."); return; }

        try {
            await runTransaction(db, async (t) => {
                const mRef = doc(collection(db, "stock_movements"));
                t.set(mRef, { 
                    variant_id: adjData.variantId, warehouse_id: adjData.warehouseId, type: 'adjustment', 
                    qty: diff, ref_id: mRef.id, ref_type: 'opname', date: serverTimestamp(), 
                    notes: adjData.note, created_by: auth.currentUser?.email 
                });
                const sRef = doc(db, "stock_snapshots", `${adjData.variantId}_${adjData.warehouseId}`);
                const sDoc = await t.get(sRef);
                if(sDoc.exists()) t.update(sRef, { qty: parseInt(adjData.realQty) });
                else t.set(sRef, { id: sRef.id, variant_id: adjData.variantId, warehouse_id: adjData.warehouseId, qty: parseInt(adjData.realQty) });
            });
            alert("Stok berhasil diupdate!");
            setModalAdjOpen(false);
            setSnapshots(prev => ({ ...prev, [`${adjData.variantId}_${adjData.warehouseId}`]: parseInt(adjData.realQty) }));
            fetchData();
        } catch (e) { alert(e.message); }
    };

    const openCard = async (vId, sku) => {
        setModalCardOpen(true);
        setCardData(null);
        try {
            const q = query(collection(db, "stock_movements"), where("variant_id", "==", vId), orderBy("date", "desc"), limit(20));
            const snap = await getDocs(q);
            setCardData(snap.docs.map(d => ({id: d.id, ...d.data()})));
        } catch (e) { setCardData([]); }
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.base_sku && p.base_sku.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        if (sortMode === 'sku') return (a.base_sku || '').localeCompare(b.base_sku || '');
        if (sortMode === 'stock_high') return b.totalStock - a.totalStock;
        return 0;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Inventory Control</h2>
                    <p className="text-sm text-gray-500 mt-1">Monitor stock levels across warehouses.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <select className="select-field w-40" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                        <option value="sku">Sort by SKU</option>
                        <option value="stock_high">Highest Stock</option>
                    </select>
                    <div className="relative flex-1 md:w-64">
                        <input type="text" placeholder="Search Product..." className="input-field pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map(p => (
                    <div key={p.id} onClick={() => openDetail(p)} className="card p-5 cursor-pointer group flex flex-col h-full relative overflow-hidden border-transparent hover:border-brand-200">
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-gray-100 text-gray-600 font-mono text-xs font-bold px-2 py-1 rounded">{p.base_sku || 'NO-SKU'}</div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{p.category}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-4 flex-1 group-hover:text-brand-600 transition-colors">{p.name}</h3>
                        
                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs text-gray-500">Total Stock</span>
                                <span className={`text-lg font-bold ${p.totalStock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{p.totalStock}</span>
                            </div>
                            {/* Stock Bar Visual */}
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-1.5 rounded-full ${p.totalStock > 50 ? 'bg-emerald-500' : (p.totalStock > 10 ? 'bg-amber-400' : 'bg-red-500')}`} style={{ width: `${Math.min(p.totalStock, 100)}%` }}></div>
                            </div>
                            <div className="mt-2 text-right text-[10px] text-gray-400">{p.variants.length} Variants</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Modal */}
            {modalDetailOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-5xl h-[85vh] flex flex-col fade-in-up">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedProduct.base_sku}</h3>
                                <p className="text-sm text-gray-500">{selectedProduct.name}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-white border border-gray-200 p-1 rounded-lg flex shadow-sm">
                                    <button onClick={() => setModalGroup('color')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${modalGroup==='color' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}>Color</button>
                                    <button onClick={() => setModalGroup('size')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${modalGroup==='size' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}>Size</button>
                                </div>
                                <button onClick={() => setModalDetailOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1 p-0">
                            <table className="table-modern">
                                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                                    <tr>
                                        <th className="pl-6">Variant</th>
                                        {warehouses.map(w => <th key={w.id} className={`text-center ${w.type==='virtual_supplier' ? 'text-brand-600 bg-brand-50/30' : ''}`}>{w.name}</th>)}
                                        <th className="text-center pr-6">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedProduct.variants.sort(sortBySize).map(v => (
                                        <tr key={v.id}>
                                            <td className="pl-6 font-medium text-gray-700">
                                                {modalGroup === 'color' ? v.size : v.color} <span className="ml-2 badge badge-neutral">{v.sku}</span>
                                            </td>
                                            {warehouses.map(w => {
                                                const qty = snapshots[`${v.id}_${w.id}`] || 0;
                                                return <td key={w.id} className={`text-center font-bold ${qty>0 ? 'text-gray-800' : 'text-gray-300'}`}>{qty}</td>
                                            })}
                                            <td className="text-center pr-6">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => openOpname(v, selectedProduct.name)} className="text-xs bg-white border border-gray-200 hover:border-brand-300 text-gray-600 px-2 py-1 rounded font-medium">Opname</button>
                                                    <button onClick={() => openCard(v.id, v.sku)} className="text-xs bg-white border border-gray-200 hover:border-brand-300 text-gray-600 px-2 py-1 rounded font-medium">Card</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Opname Modal */}
            {modalAdjOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 fade-in-up">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Stock Opname</h3>
                        <div className="bg-brand-50 p-3 rounded-lg border border-brand-100 mb-4">
                            <p className="font-mono font-bold text-brand-700 text-sm">{adjData.sku}</p>
                            <p className="text-xs text-brand-600 mt-0.5">{adjData.productName}</p>
                        </div>
                        <form onSubmit={submitOpname} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gudang</label>
                                <select className="select-field" value={adjData.warehouseId} onChange={handleAdjWarehouseChange}>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sistem</label>
                                    <input disabled className="input-field bg-gray-100 text-center font-bold" value={adjData.currentQty} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-brand-600 uppercase mb-1">Fisik (Real)</label>
                                    <input type="number" required className="input-field border-brand-300 focus:ring-brand-200 text-center font-bold text-brand-700" value={adjData.realQty} onChange={e => setAdjData({...adjData, realQty: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Catatan</label>
                                <textarea required className="input-field" rows="2" value={adjData.note} onChange={e => setAdjData({...adjData, note: e.target.value})} placeholder="Alasan penyesuaian..."></textarea>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setModalAdjOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" className="btn-primary">Update Stock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Card Modal */}
            {modalCardOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-0 overflow-hidden fade-in-up">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Kartu Stok (History)</h3>
                            <button onClick={() => setModalCardOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto">
                            <table className="table-modern">
                                <thead><tr><th className="pl-6">Tanggal</th><th>Tipe</th><th>Gudang</th><th className="text-right">Qty</th><th>Ket</th></tr></thead>
                                <tbody>
                                    {!cardData ? <tr><td colSpan="5" className="text-center p-6">Loading...</td></tr> : cardData.length === 0 ? <tr><td colSpan="5" className="text-center p-6 italic text-gray-400">Belum ada mutasi.</td></tr> : cardData.map(m => (
                                        <tr key={m.id}>
                                            <td className="pl-6 text-xs text-gray-500">{new Date(m.date.toDate()).toLocaleDateString()}</td>
                                            <td><span className="badge badge-neutral">{m.type}</span></td>
                                            <td className="text-xs">{warehouses.find(w => w.id === m.warehouse_id)?.name}</td>
                                            <td className={`text-right font-mono font-bold ${m.qty > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                                            <td className="text-xs text-gray-500 truncate max-w-[150px]">{m.notes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}