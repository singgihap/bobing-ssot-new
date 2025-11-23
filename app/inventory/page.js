// app/inventory/page.js
"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, where, serverTimestamp, limit } from 'firebase/firestore';
import { sortBySize } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';

export default function InventoryPage() {
    // --- STATE ---
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProductId, setExpandedProductId] = useState(null); 
    
    // Modals State
    const [modalAdjOpen, setModalAdjOpen] = useState(false);
    const [modalCardOpen, setModalCardOpen] = useState(false);
    const [modalDetailOpen, setModalDetailOpen] = useState(false); // Detail Modal State
    const [selectedProduct, setSelectedProduct] = useState(null); // Selected Product for Detail
    
    // Selected Data for Modals
    const [adjData, setAdjData] = useState({});
    const [cardData, setCardData] = useState([]);
    const [modalGroup, setModalGroup] = useState('color');

    useEffect(() => { fetchData(); }, []);

    // --- FETCH DATA ---
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

            const sorted = Object.values(prodMap).sort((a,b) => b.totalStock - a.totalStock);
            setProducts(sorted);

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // --- LOGIC ---
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.base_sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleAccordion = (id) => {
        setExpandedProductId(expandedProductId === id ? null : id);
    };

    // --- ACTIONS ---
    const openDetail = (prod) => {
        setSelectedProduct(prod);
        setModalDetailOpen(true);
    };

    const openOpname = (v, prodName) => {
        setAdjData({ 
            variantId: v.id, sku: v.sku, productName: prodName, 
            warehouseId: warehouses[0]?.id, 
            currentQty: snapshots[`${v.id}_${warehouses[0]?.id}`] || 0, 
            realQty: '', note: ''
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
        if (isNaN(diff) || diff === 0) return alert("Tidak ada perubahan.");

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
            
            setSnapshots(prev => ({ ...prev, [`${adjData.variantId}_${adjData.warehouseId}`]: parseInt(adjData.realQty) }));
            const updatedProducts = [...products];
            const prodIdx = updatedProducts.findIndex(p => p.variants.some(v => v.id === adjData.variantId));
            if(prodIdx > -1) {
                updatedProducts[prodIdx].totalStock += diff;
                setProducts(updatedProducts);
            }
            setModalAdjOpen(false); 
        } catch (e) { alert(e.message); }
    };

    const openCard = async (vId, sku) => {
        setModalCardOpen(true); setCardData(null);
        try {
            const q = query(collection(db, "stock_movements"), where("variant_id", "==", vId), orderBy("date", "desc"), limit(20));
            const snap = await getDocs(q);
            setCardData(snap.docs.map(d => ({id: d.id, ...d.data()})));
        } catch (e) { setCardData([]); }
    };

    return (
        <div className="space-y-8 fade-in pb-20">
            {/* --- HEADER SECTION --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-display font-semibold text-lumina-text tracking-tight">Inventory Control</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Monitor stok fisik & virtual secara real-time.</p>
                </div>
                
                <div className="bg-lumina-surface p-1.5 rounded-xl border border-lumina-border shadow-lg flex items-center w-full md:w-80 focus-within:ring-1 focus-within:ring-lumina-gold transition-all">
                    <div className="pl-3 text-lumina-muted">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search Product or SKU..." 
                        className="w-full bg-transparent text-lumina-text text-sm px-3 py-2 outline-none placeholder:text-lumina-muted/50 font-mono"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* --- INVENTORY TABLE (ACCORDION) --- */}
            <div className="card-luxury overflow-hidden min-h-[500px]">
                <div className="table-wrapper-dark border-none shadow-none rounded-none">
                    <table className="table-dark">
                        <thead>
                            <tr>
                                <th className="w-16 pl-6">Img</th>
                                <th>Product Name</th>
                                <th>Base SKU</th>
                                <th className="text-center">Category</th>
                                <th className="text-right pr-8">Total Stock</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="px-6 py-12 text-center text-lumina-muted animate-pulse">Calculating Stock...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-12 text-center text-lumina-muted">No products found.</td></tr>
                            ) : (
                                filteredProducts.map(p => {
                                    const isExpanded = expandedProductId === p.id;
                                    const isLowStock = p.totalStock <= 10;
                                    
                                    return (
                                        <React.Fragment key={p.id}>
                                            {/* PARENT ROW */}
                                            <tr 
                                                onClick={() => toggleAccordion(p.id)}
                                                className={`group cursor-pointer transition-all duration-200 ${isExpanded ? 'bg-lumina-highlight/30 border-l-4 border-l-lumina-gold' : 'hover:bg-lumina-highlight/20 border-l-4 border-l-transparent'}`}
                                            >
                                                <td className="pl-6 py-4">
                                                    <div className="w-12 h-12 rounded-lg bg-lumina-base border border-lumina-border flex items-center justify-center overflow-hidden shadow-inner">
                                                        {p.image_url ? (
                                                            <img src={p.image_url} alt="Product" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <svg className="w-5 h-5 text-lumina-muted opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-display font-medium text-lumina-text text-base group-hover:text-lumina-gold transition-colors">{p.name}</div>
                                                    <div className="text-xs text-lumina-muted mt-1">{p.variants.length} Variants</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-sm text-lumina-muted group-hover:text-white transition-colors">{p.base_sku}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="badge-luxury badge-neutral">{p.category}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right pr-8">
                                                    <span className={`text-lg font-mono font-bold ${p.totalStock === 0 ? 'text-rose-500' : (isLowStock ? 'text-amber-500' : 'text-emerald-400')}`}>
                                                        {p.totalStock}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`transform transition-transform duration-300 text-lumina-gold inline-block ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                                    </span>
                                                </td>
                                            </tr>

                                            {/* EXPANDED CONTENT */}
                                            {isExpanded && (
                                                <tr className="bg-[#0F1115] shadow-inner border-b border-lumina-border">
                                                    <td colSpan="6" className="p-0">
                                                        <div className="p-6 fade-in">
                                                            <div className="border border-lumina-border rounded-lg overflow-hidden w-full bg-lumina-base">
                                                                <table className="w-full text-sm text-left">
                                                                    <thead className="bg-lumina-surface text-[10px] text-lumina-muted uppercase tracking-wider font-semibold border-b border-lumina-border">
                                                                        <tr>
                                                                            <th className="px-4 py-3 w-48">Variant SKU</th>
                                                                            <th className="px-4 py-3 w-32">Spec</th>
                                                                            {warehouses.map(w => (
                                                                                <th key={w.id} className={`px-4 py-3 text-center border-l border-lumina-border ${w.type==='virtual_supplier' ? 'text-indigo-400' : 'text-emerald-500'}`}>
                                                                                    {w.name}
                                                                                </th>
                                                                            ))}
                                                                            <th className="px-4 py-3 text-right">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-lumina-border">
                                                                        {p.variants.sort(sortBySize).map(v => (
                                                                            <tr key={v.id} className="hover:bg-lumina-highlight/20 transition-colors">
                                                                                <td className="px-4 py-3 font-mono text-lumina-gold text-xs font-bold">{v.sku}</td>
                                                                                <td className="px-4 py-3 text-lumina-text">
                                                                                    <div className="flex gap-2">
                                                                                        <span className="badge-luxury badge-neutral">{v.color}</span>
                                                                                        <span className="badge-luxury badge-neutral">{v.size}</span>
                                                                                    </div>
                                                                                </td>
                                                                                {warehouses.map(w => {
                                                                                    const qty = snapshots[`${v.id}_${w.id}`] || 0;
                                                                                    return (
                                                                                        <td key={w.id} className="px-4 py-3 text-center border-l border-lumina-border/30">
                                                                                            <span className={`font-mono font-medium ${qty > 0 ? 'text-white' : 'text-lumina-border'}`}>
                                                                                                {qty}
                                                                                            </span>
                                                                                        </td>
                                                                                    )
                                                                                })}
                                                                                <td className="px-4 py-3 text-right">
                                                                                    <div className="flex justify-end gap-2">
                                                                                        <button onClick={(e) => { e.stopPropagation(); openOpname(v, p.name); }} className="text-[10px] uppercase font-bold text-lumina-muted hover:text-lumina-gold border border-lumina-border hover:border-lumina-gold rounded px-2 py-1 transition-colors">
                                                                                            Opname
                                                                                        </button>
                                                                                        <button onClick={(e) => { e.stopPropagation(); openCard(v.id, v.sku); }} className="text-[10px] uppercase font-bold text-lumina-muted hover:text-white border border-lumina-border hover:border-white rounded px-2 py-1 transition-colors">
                                                                                            History
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- DETAIL MODAL (FIXED HEIGHT & SCROLL) --- */}
            <Portal>
            {modalDetailOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-lumina-border flex justify-between items-center bg-lumina-surface z-10">
                            <div className="flex items-center gap-4">
                                {selectedProduct.image_url && <img src={selectedProduct.image_url} className="w-12 h-12 rounded-lg border border-lumina-border object-cover" />}
                                <div>
                                    <h3 className="text-xl font-bold text-white font-display">{selectedProduct.base_sku}</h3>
                                    <p className="text-sm text-lumina-muted">{selectedProduct.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-lumina-base border border-lumina-border p-1 rounded-lg flex shadow-sm">
                                    <button onClick={() => setModalGroup('color')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${modalGroup==='color' ? 'bg-lumina-gold text-black' : 'text-lumina-muted hover:bg-lumina-highlight'}`}>Color</button>
                                    <button onClick={() => setModalGroup('size')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${modalGroup==='size' ? 'bg-lumina-gold text-black' : 'text-lumina-muted hover:bg-lumina-highlight'}`}>Size</button>
                                </div>
                                <button onClick={() => setModalDetailOpen(false)} className="text-lumina-muted hover:text-white p-1 text-2xl">✕</button>
                            </div>
                        </div>
                        
                        {/* SCROLLABLE CONTENT */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-lumina-base">
                            <table className="table-dark w-full">
                                <thead className="sticky top-0 z-10 bg-lumina-surface shadow-md border-b border-lumina-border">
                                    <tr>
                                        <th className="pl-6">Variant</th>
                                        {warehouses.map(w => <th key={w.id} className={`text-center ${w.type==='virtual_supplier' ? 'text-indigo-400' : 'text-emerald-500'}`}>{w.name}</th>)}
                                        <th className="text-center pr-6">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-lumina-border">
                                    {selectedProduct.variants.sort(sortBySize).map(v => (
                                        <tr key={v.id} className="hover:bg-lumina-highlight/20">
                                            <td className="pl-6 font-medium text-lumina-text">
                                                {modalGroup === 'color' ? v.size : v.color} <span className="ml-2 badge-luxury badge-neutral">{v.sku}</span>
                                            </td>
                                            {warehouses.map(w => {
                                                const qty = snapshots[`${v.id}_${w.id}`] || 0;
                                                return <td key={w.id} className={`text-center font-mono font-bold ${qty>0 ? 'text-white' : 'text-lumina-border'}`}>{qty}</td>
                                            })}
                                            <td className="text-center pr-6">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => openOpname(v, selectedProduct.name)} className="btn-ghost-dark px-2 py-1 text-[10px]">Opname</button>
                                                    <button onClick={() => openCard(v.id, v.sku)} className="btn-ghost-dark px-2 py-1 text-[10px]">History</button>
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
            </Portal>

            {/* --- STOCK OPNAME MODAL (FIXED) --- */}
            <Portal>
            {modalAdjOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface rounded-2xl shadow-2xl border border-lumina-border w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden ring-1 ring-lumina-gold/20">
                        <div className="px-6 py-5 border-b border-lumina-border bg-lumina-surface rounded-t-2xl">
                            <h3 className="text-lg font-display font-bold text-white">Stock Opname</h3>
                            <p className="text-xs text-lumina-muted mt-1">Adjust stock discrepancy.</p>
                        </div>
                        
                        {/* SCROLLABLE FORM */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            <div className="bg-lumina-base p-4 rounded-lg border border-lumina-border flex justify-between items-center">
                                <div>
                                    <p className="font-mono font-bold text-lumina-gold text-sm">{adjData.sku}</p>
                                    <p className="text-xs text-lumina-text mt-0.5">{adjData.productName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-lumina-muted uppercase">System Qty</p>
                                    <p className="text-lg font-bold text-white font-mono">{adjData.currentQty}</p>
                                </div>
                            </div>
                            
                            <form onSubmit={submitOpname} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-lumina-muted uppercase mb-1 block">Warehouse</label>
                                    <select className="input-luxury" value={adjData.warehouseId} onChange={handleAdjWarehouseChange}>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-lumina-gold uppercase mb-1 block">New Physical Quantity</label>
                                    <input type="number" required className="input-luxury border-lumina-gold text-center font-bold text-white bg-lumina-gold/10 focus:ring-lumina-gold text-lg py-3" value={adjData.realQty} onChange={e => setAdjData({...adjData, realQty: e.target.value})} autoFocus placeholder="0" />
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-lumina-muted uppercase mb-1 block">Reason / Notes</label>
                                    <textarea required className="input-luxury" rows="2" value={adjData.note} onChange={e => setAdjData({...adjData, note: e.target.value})} placeholder="E.g. Broken goods, Found item..."></textarea>
                                </div>
                                
                                {/* FOOTER (Inside form so it scrolls with content on very small screens, or you can move it out) */}
                                <div className="flex justify-end gap-3 pt-2 border-t border-lumina-border mt-4">
                                    <button type="button" onClick={() => setModalAdjOpen(false)} className="btn-ghost-dark">Cancel</button>
                                    <button type="submit" className="btn-gold">Save Adjustment</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            </Portal>

            {/* --- STOCK CARD MODAL (FIXED) --- */}
            <Portal>
            {modalCardOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface rounded-2xl shadow-2xl border border-lumina-border w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden">
                        <div className="px-6 py-5 border-b border-lumina-border flex justify-between items-center bg-lumina-surface">
                            <h3 className="text-lg font-display font-bold text-white">Stock History</h3>
                            <button onClick={() => setModalCardOpen(false)} className="text-lumina-muted hover:text-white text-xl">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-lumina-base">
                            <table className="table-dark w-full">
                                <thead className="sticky top-0 z-10 bg-lumina-surface border-b border-lumina-border">
                                    <tr><th className="pl-6">Date</th><th>Type</th><th>Warehouse</th><th className="text-right">Qty</th><th>Note</th></tr>
                                </thead>
                                <tbody>
                                    {!cardData ? <tr><td colSpan="5" className="text-center p-6 text-lumina-muted">Loading...</td></tr> : cardData.length === 0 ? <tr><td colSpan="5" className="text-center p-6 italic text-lumina-muted">No history found.</td></tr> : cardData.map(m => (
                                        <tr key={m.id}>
                                            <td className="pl-6 text-xs text-lumina-muted font-mono">{new Date(m.date.toDate()).toLocaleDateString()}</td>
                                            <td><span className="badge-luxury badge-neutral">{m.type}</span></td>
                                            <td className="text-xs text-lumina-text">{warehouses.find(w => w.id === m.warehouse_id)?.name}</td>
                                            <td className={`text-right font-mono font-bold ${m.qty > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                                            <td className="text-xs text-lumina-muted truncate max-w-[150px]">{m.notes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}