"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, where, limit, serverTimestamp } from 'firebase/firestore';
import { sortBySize } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE ---
const CACHE_KEY = 'lumina_inventory_v2'; // Key baru untuk versi optimized
const CACHE_DURATION = 15 * 60 * 1000; // 15 Menit (Data stok inventory tidak perlu realtime detik-an untuk list view)

export default function InventoryPage() {
    // --- STATE ---
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [snapshots, setSnapshots] = useState({}); // Map: variantId_warehouseId -> qty
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProductId, setExpandedProductId] = useState(null); 
    
    // Modals State
    const [modalAdjOpen, setModalAdjOpen] = useState(false);
    const [modalCardOpen, setModalCardOpen] = useState(false);
    
    // Selected Data for Modals
    const [adjData, setAdjData] = useState({});
    const [cardData, setCardData] = useState([]);

    useEffect(() => { 
        fetchData(); 
    }, []);

    // Helper untuk chunking query "IN" (Firestore limit 30 per batch)
    const fetchInBatches = async (collectionName, fieldName, values) => {
        const results = [];
        const chunks = [];
        const chunkSize = 30; // Aman di bawah limit 30 Firestore

        for (let i = 0; i < values.length; i += chunkSize) {
            chunks.push(values.slice(i, i + chunkSize));
        }

        await Promise.all(chunks.map(async (chunk) => {
            if (chunk.length === 0) return;
            const q = query(collection(db, collectionName), where(fieldName, 'in', chunk));
            const snap = await getDocs(q);
            snap.forEach(d => results.push({ id: d.id, ...d.data() }));
        }));

        return results;
    };

    // --- FETCH DATA (Highly Optimized) ---
    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache LocalStorage (Bukan Session)
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { products, warehouses, snapshots, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setProducts(products);
                        setWarehouses(warehouses);
                        setSnapshots(snapshots);
                        setLoading(false);
                        return;
                    }
                }
            }

            // 2. Fetch Data Ringan (Warehouses & Products Limit)
            const [snapWh, snapProd] = await Promise.all([
                getDocs(query(collection(db, "warehouses"), orderBy("created_at", "asc"))),
                getDocs(query(collection(db, "products"), orderBy("name", "asc"), limit(50))) // Limit 50: Hemat Biaya
            ]);

            const whList = []; 
            snapWh.forEach(d => whList.push({id: d.id, ...d.data()}));
            setWarehouses(whList);

            const prodMap = {};
            const productIds = [];
            snapProd.forEach(d => {
                const p = d.data();
                prodMap[d.id] = { id: d.id, ...p, variants: [], totalStock: 0 };
                productIds.push(d.id);
            });

            // 3. Targeted Fetching (Hanya data terkait produk yang diambil)
            let vars = [];
            let shots = {};

            if (productIds.length > 0) {
                // Hanya ambil variants milik 50 produk ini
                vars = await fetchInBatches("product_variants", "product_id", productIds);
                
                const variantIds = vars.map(v => v.id);
                
                if (variantIds.length > 0) {
                    // Hanya ambil snapshots milik variants ini
                    const snapshotList = await fetchInBatches("stock_snapshots", "variant_id", variantIds);
                    snapshotList.forEach(s => {
                        shots[`${s.variant_id}_${s.warehouse_id}`] = s.qty || 0; // Mapping ID manual jika perlu, atau pakai ID dokumen
                        shots[s.id] = s.qty || 0; // Fallback access
                    });
                }
            }
            
            setSnapshots(shots);

            // Mapping Logic
            vars.forEach(v => {
                if (prodMap[v.product_id]) {
                    let total = 0;
                    whList.forEach(w => {
                        // Coba akses pakai ID komposit standar
                        const key = `${v.id}_${w.id}`;
                        total += (shots[key] || 0);
                    });
                    prodMap[v.product_id].variants.push(v);
                    prodMap[v.product_id].totalStock += total;
                }
            });

            const sorted = Object.values(prodMap).sort((a,b) => b.totalStock - a.totalStock);
            setProducts(sorted);

            // 4. Simpan Cache
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    products: sorted,
                    warehouses: whList,
                    snapshots: shots,
                    timestamp: Date.now()
                }));
            }

        } catch (e) { 
            console.error("Inventory Fetch Error:", e); 
            toast.error("Gagal memuat stok");
        } finally { 
            setLoading(false); 
        }
    };

    // --- SEARCH LOGIC (Client Side Filter for Cached Data) ---
    // Note: Untuk dataset besar (>1000), sebaiknya buat fungsi search khusus ke server
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.base_sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleAccordion = (id) => {
        setExpandedProductId(expandedProductId === id ? null : id);
    };

    // --- ACTIONS ---
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
        if (isNaN(diff) || diff === 0) return toast.error("Tidak ada perubahan.");

        const toastId = toast.loading("Mengupdate stok...");
        try {
            await runTransaction(db, async (t) => {
                // 1. Catat Movement
                const mRef = doc(collection(db, "stock_movements"));
                t.set(mRef, { 
                    variant_id: adjData.variantId, warehouse_id: adjData.warehouseId, type: 'adjustment', 
                    qty: diff, ref_id: mRef.id, ref_type: 'opname', date: serverTimestamp(), 
                    notes: adjData.note, created_by: auth.currentUser?.email || 'system'
                });

                // 2. Update Snapshot (Pakai ID Composite variantId_warehouseId)
                const snapshotId = `${adjData.variantId}_${adjData.warehouseId}`;
                const sRef = doc(db, "stock_snapshots", snapshotId);
                const sDoc = await t.get(sRef);
                
                if(sDoc.exists()) {
                    t.update(sRef, { qty: parseInt(adjData.realQty) });
                } else {
                    t.set(sRef, { 
                        id: snapshotId, 
                        variant_id: adjData.variantId, 
                        warehouse_id: adjData.warehouseId, 
                        qty: parseInt(adjData.realQty) 
                    });
                }
            });
            
            toast.success("Stok berhasil diupdate!", { id: toastId });
            
            // Invalidate Cache & Refresh
            if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
            setModalAdjOpen(false);
            fetchData(true);

        } catch (e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId });
        }
    };

    const openCard = async (vId, sku) => {
        setModalCardOpen(true); setCardData(null);
        try {
            // Query history tetap on-demand (tidak di-cache agresif karena realtime)
            const q = query(collection(db, "stock_movements"), where("variant_id", "==", vId), orderBy("date", "desc"), limit(20));
            const snap = await getDocs(q);
            setCardData(snap.docs.map(d => ({id: d.id, ...d.data()})));
        } catch (e) { setCardData([]); }
    };

    return (
        <div className="space-y-6 fade-in pb-20">
            {/* --- HEADER SECTION (FIXED & SOLID) --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-lumina-surface px-4 md:px-8 py-4 border-b border-lumina-border/50 shadow-md sticky top-0 z-30 md:static">
                <div>
                    <h2 className="text-xl md:text-3xl font-display font-semibold text-lumina-text tracking-tight">
                    Inventory Control
                    </h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light hidden md:block">
                    Monitor stok fisik & virtual secara real-time.
                    </p>
                </div>
                {/* Search input */}
                <div className="w-full md:w-80 bg-lumina-surface p-1.5 rounded-xl border border-lumina-border shadow-lg flex items-center focus-within:ring-1 focus-within:ring-lumina-gold transition-all">
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

            {/* --- DESKTOP VIEW (TABLE) --- */}
            <div className="hidden md:block card-luxury overflow-hidden min-h-[500px]">
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
                                <tr><td colSpan="6" className="px-6 py-12 text-center text-lumina-muted animate-pulse">Loading Inventory Data...</td></tr>
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
                                                    <div className="w-12 h-12 rounded-lg bg-lumina-surface border border-lumina-border flex items-center justify-center overflow-hidden shadow-inner">
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
                                                    <span className="font-mono text-sm text-lumina-muted group-hover:text-lumina-text transition-colors">{p.base_sku}</span>
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
                                                            <div className="border border-lumina-border rounded-lg overflow-hidden w-full bg-lumina-surface">
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
                                                                                            <span className={`font-mono font-medium ${qty > 0 ? 'text-lumina-text' : 'text-lumina-border'}`}>
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
                                                                                        <button onClick={(e) => { e.stopPropagation(); openCard(v.id, v.sku); }} className="text-[10px] uppercase font-bold text-lumina-muted hover:text-lumina-text border border-lumina-border hover:border-white rounded px-2 py-1 transition-colors">
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

             {/* --- MOBILE VIEW (CARDS) --- */}
             <div className="md:hidden grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-10 text-lumina-muted animate-pulse">Loading Inventory...</div>
                ) : filteredProducts.length === 0 ? (
                     <div className="text-center py-10 text-lumina-muted">No products found.</div>
                ) : (
                    filteredProducts.map(p => {
                         const isExpanded = expandedProductId === p.id;
                         const isLowStock = p.totalStock <= 10;

                         return (
                             <div key={p.id} onClick={() => toggleAccordion(p.id)} className="card-luxury p-4 active:scale-[0.98] transition-transform">
                                {/* Card Header */}
                                <div className="flex gap-4 items-start">
                                    <div className="w-16 h-16 rounded-lg bg-lumina-surface border border-lumina-border flex-shrink-0 overflow-hidden">
                                         {p.image_url ? (
                                            <img src={p.image_url} alt="Product" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lumina-muted"><span className="text-xs">IMG</span></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                             <span className="text-xs font-mono font-bold text-lumina-gold bg-lumina-surface px-1.5 py-0.5 rounded border border-lumina-border">{p.base_sku}</span>
                                             <span className={`text-sm font-bold font-mono ${p.totalStock === 0 ? 'text-rose-500' : (isLowStock ? 'text-amber-500' : 'text-emerald-400')}`}>
                                                {p.totalStock} <span className="text-[10px] text-lumina-muted font-normal">qty</span>
                                             </span>
                                        </div>
                                        <h3 className="text-sm font-bold text-lumina-text mt-1 truncate">{p.name}</h3>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] text-lumina-muted">{p.variants.length} Varian</span>
                                            <span className="badge-luxury badge-neutral text-[9px]">{p.category}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content (Variants) */}
                                {isExpanded && (
                                    <div className="mt-4 border-t border-lumina-border pt-3 space-y-4 animate-fade-in">
                                            {p.variants.sort(sortBySize).map(v => (
                                                <div key={v.id} className="bg-lumina-surface/50 rounded-lg p-3 border border-lumina-border/50">
                                                    <div className="flex justify-between items-center mb-2">
                                                         <div>
                                                            <div className="text-xs font-mono text-lumina-gold">{v.sku}</div>
                                                            <div className="text-[10px] text-lumina-text">{v.color} / {v.size}</div>
                                                         </div>
                                                         <div className="flex gap-2">
                                                             <button onClick={(e) => { e.stopPropagation(); openOpname(v, p.name); }} className="px-2 py-1 bg-lumina-surface border border-lumina-border rounded text-[10px] hover:border-lumina-gold text-lumina-muted hover:text-lumina-gold">Opname</button>
                                                             <button onClick={(e) => { e.stopPropagation(); openCard(v.id, v.sku); }} className="px-2 py-1 bg-lumina-surface border border-lumina-border rounded text-[10px] hover:border-white text-lumina-muted hover:text-lumina-text">History</button>
                                                         </div>
                                                    </div>
                                                    
                                                    {/* Warehouse Breakdown (Mobile Grid) */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {warehouses.map(w => {
                                                            const qty = snapshots[`${v.id}_${w.id}`] || 0;
                                                            if(w.type === 'virtual_supplier' && qty === 0) return null; 
                                                            return (
                                                                <div key={w.id} className="flex justify-between items-center text-[10px] bg-lumina-surface px-2 py-1 rounded border border-lumina-border/30">
                                                                    <span className={`truncate max-w-[80px] ${w.type==='virtual_supplier' ? 'text-indigo-400' : 'text-lumina-muted'}`}>{w.name}</span>
                                                                    <span className={`font-mono font-bold ${qty > 0 ? 'text-lumina-text' : 'text-lumina-muted/30'}`}>{qty}</span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                             </div>
                         );
                    })
                )}
            </div>

            {/* --- STOCK OPNAME MODAL (FIXED) --- */}
            <Portal>
            {modalAdjOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-lumina-surface/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface rounded-2xl shadow-2xl border border-lumina-border w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden ring-1 ring-lumina-gold/20">
                        <div className="px-6 py-5 border-b border-lumina-border bg-lumina-surface rounded-t-2xl">
                            <h3 className="text-lg font-display font-bold text-lumina-text">Stock Opname</h3>
                            <p className="text-xs text-lumina-muted mt-1">Adjust stock discrepancy.</p>
                        </div>
                        
                        {/* SCROLLABLE FORM */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            <div className="bg-lumina-surface p-4 rounded-lg border border-lumina-border flex justify-between items-center">
                                <div>
                                    <p className="font-mono font-bold text-lumina-gold text-sm">{adjData.sku}</p>
                                    <p className="text-xs text-lumina-text mt-0.5">{adjData.productName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-lumina-muted uppercase">System Qty</p>
                                    <p className="text-lg font-bold text-lumina-text font-mono">{adjData.currentQty}</p>
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
                                    <input type="number" required className="input-luxury border-lumina-gold text-center font-bold text-lumina-text bg-lumina-gold/10 focus:ring-lumina-gold text-lg py-3" value={adjData.realQty} onChange={e => setAdjData({...adjData, realQty: e.target.value})} autoFocus placeholder="0" />
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-lumina-muted uppercase mb-1 block">Reason / Notes</label>
                                    <textarea required className="input-luxury" rows="2" value={adjData.note} onChange={e => setAdjData({...adjData, note: e.target.value})} placeholder="E.g. Broken goods, Found item..."></textarea>
                                </div>
                                
                                {/* FOOTER */}
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-lumina-surface/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface rounded-2xl shadow-2xl border border-lumina-border w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden">
                        <div className="px-6 py-5 border-b border-lumina-border flex justify-between items-center bg-lumina-surface">
                            <h3 className="text-lg font-display font-bold text-lumina-text">Stock History</h3>
                            <button onClick={() => setModalCardOpen(false)} className="text-lumina-muted hover:text-lumina-text text-xl">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-lumina-surface">
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