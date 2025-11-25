"use client";
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, serverTimestamp, limit, where } from 'firebase/firestore';
import { sortBySize } from '@/lib/utils';
import Sortable from 'sortablejs';
import { Portal } from '@/lib/usePortal';
import React from 'react'; 

// Cache Configuration
const CACHE_KEY = 'lumina_virtual_stock_master';
const CACHE_DURATION = 5 * 60 * 1000; 

export default function VirtualStockPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [variants, setVariants] = useState([]);
    
    // Snapshot diload lazy (hanya saat supplier dipilih) untuk hemat biaya
    const [snapshots, setSnapshots] = useState({});
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);
    
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [visibleProducts, setVisibleProducts] = useState([]);
    const gridRef = useRef(null);
    
    // Mobile State
    const [expandedProductId, setExpandedProductId] = useState(null);
    
    const [modalOpen, setModalOpen] = useState(false);
    const [currentModalProd, setCurrentModalProd] = useState(null);
    const [modalUpdates, setModalUpdates] = useState({});
    
    // Grouping State for Modal
    const [groupBy, setGroupBy] = useState('size'); // 'size' | 'color'

    useEffect(() => { fetchData(); }, []);

    // Set default supplier (Mas Tohir)
    useEffect(() => {
        if (suppliers.length > 0 && !selectedSupplierId) {
            const masTohir = suppliers.find(s => s.name === 'Mas Tohir');
            if (masTohir) {
                handleSupplierChange({ target: { value: masTohir.id } });
            }
        }
    }, [suppliers]);

    useEffect(() => {
        if (gridRef.current && visibleProducts.length > 0) {
            new Sortable(gridRef.current, { animation: 150, ghostClass: 'opacity-50' });
        }
    }, [visibleProducts]);

    const fetchData = async () => {
        try {
            // 1. Cek Cache (Master Data Only)
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const { suppliers, warehouses, products, variants, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    setSuppliers(suppliers);
                    setWarehouses(warehouses);
                    setProducts(products);
                    setVariants(variants);
                    return;
                }
            }

            // 2. Fetch Fresh (Master Data Only - NO SNAPSHOTS YET)
            const [sSupp, sWh, sProd, sVar] = await Promise.all([
                getDocs(query(collection(db, "suppliers"), orderBy("name"))),
                getDocs(collection(db, "warehouses")),
                getDocs(query(collection(db, "products"), limit(100))), 
                getDocs(query(collection(db, "product_variants"), orderBy("sku"))),
            ]);

            const supps = []; sSupp.forEach(d => supps.push({id: d.id, ...d.data()}));
            const whs = []; sWh.forEach(d => whs.push({id: d.id, ...d.data()}));
            const prods = []; sProd.forEach(d => prods.push({id: d.id, ...d.data()}));
            const vars = []; sVar.forEach(d => vars.push({id: d.id, ...d.data()}));

            setSuppliers(supps);
            setWarehouses(whs);
            setProducts(prods);
            setVariants(vars);

            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                suppliers: supps,
                warehouses: whs,
                products: prods,
                variants: vars,
                timestamp: Date.now()
            }));

        } catch (e) { console.error(e); }
    };

    const handleSupplierChange = async (e) => {
        const suppId = e.target ? e.target.value : e; // Support event or direct value
        setSelectedSupplierId(suppId);
        
        if (!suppId) { setVisibleProducts([]); return; }
        
        const wh = warehouses.find(w => w.type === 'virtual_supplier' && w.supplier_id === suppId);
        if (!wh) { setVisibleProducts([]); return; }

        // --- OPTIMIZED: Fetch snapshots ONLY for this warehouse ---
        setLoadingSnapshots(true);
        try {
            const qSnap = query(collection(db, "stock_snapshots"), where("warehouse_id", "==", wh.id));
            const sSnap = await getDocs(qSnap);
            const newSnaps = {};
            sSnap.forEach(d => newSnaps[d.id] = d.data());
            setSnapshots(newSnaps); // Replace local snapshots state with specific warehouse data

            // Build Product List
            const grouped = {};
            variants.forEach(v => {
                if (!grouped[v.product_id]) {
                    const p = products.find(x => x.id === v.product_id);
                    if(p) grouped[v.product_id] = { ...p, variants: [], totalStock: 0 };
                }
                if(grouped[v.product_id]) {
                    grouped[v.product_id].variants.push(v);
                    // Hitung total dari snapshot yang baru di-fetch
                    grouped[v.product_id].totalStock += (newSnaps[`${v.id}_${wh.id}`]?.qty || 0);
                }
            });
            setVisibleProducts(Object.values(grouped).sort((a,b) => (a.base_sku||'').localeCompare(b.base_sku||'')));
        } catch(e) {
            console.error("Error loading snapshots:", e);
        } finally {
            setLoadingSnapshots(false);
        }
    };

    const openModal = (prod) => { 
        setCurrentModalProd(prod); 
        setModalUpdates({}); 
        setGroupBy('size'); 
        setModalOpen(true); 
    };

    // Helper Actions
    const quickSet = (variantId, value, mode = 'set') => {
        setModalUpdates(prev => {
            const currentVal = parseInt(prev[variantId] || 0);
            let newVal = value;
            if (mode === 'add') newVal = (isNaN(currentVal) ? 0 : currentVal) + value;
            return { ...prev, [variantId]: newVal };
        });
    };

    const hasChanges = Object.keys(modalUpdates).length > 0;

    const saveModal = async () => {
        if (!hasChanges) return;

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
                t.set(sessRef, { supplier_id: selectedSupplierId, warehouse_id: wh.id, date: serverTimestamp(), created_by: user?.email, type: 'overwrite' });
                
                for(const up of updates) {
                    const k = `${up.variantId}_${wh.id}`;
                    const snapRef = doc(db, "stock_snapshots", k);
                    const sDoc = await t.get(snapRef);
                    
                    t.set(doc(collection(db, "stock_movements")), { 
                        variant_id: up.variantId, warehouse_id: wh.id, type: 'supplier_sync', 
                        qty: up.diff, ref_id: sessRef.id, ref_type: 'supplier_session', date: serverTimestamp() 
                    });
                    
                    if(sDoc.exists()) t.update(snapRef, { qty: up.real, updated_at: serverTimestamp() }); 
                    else t.set(snapRef, { id: k, variant_id: up.variantId, warehouse_id: wh.id, qty: up.real, updated_at: serverTimestamp() });
                }
            });
            
            alert("Stok terupdate!"); 
            setModalOpen(false); 
            
            // Update local snapshots optimistically or re-fetch
            // Re-fetch is safer to sync with DB
            handleSupplierChange(selectedSupplierId); 
            
            // Invalidate other caches
            sessionStorage.removeItem('lumina_inventory_data'); 

        } catch(e) { alert(e.message); }
    };

    const toggleAccordion = (id) => {
        setExpandedProductId(expandedProductId === id ? null : id);
    };

    const getGroupedVariants = (variants) => {
        const groups = {};
        variants.forEach(v => {
            const key = groupBy === 'size' ? (v.size || 'Other') : (v.color || 'Other');
            if (!groups[key]) groups[key] = [];
            groups[key].push(v);
        });
        return groups;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
             {/* Header */}
             <div className="sticky top-0 z-30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface -mx-4 px-4 md:-mx-8 md:px-8 py-4 border-b border-lumina-border/50 shadow-md">
                <div>
                    <h2 className="text-xl md:text-3xl font-display font-bold text-text-primary tracking-tight">Virtual Stock Map</h2>
                    <p className="text-sm text-text-secondary mt-1 font-light hidden md:block">Drag & Drop cards to organize supplier products.</p>
                </div>
                <select 
                    className="input-luxury w-full md:w-64 font-medium" 
                    value={selectedSupplierId} 
                    onChange={handleSupplierChange}
                >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {selectedSupplierId && (
                <>
                    {loadingSnapshots && <div className="text-center py-8 text-lumina-gold animate-pulse">Memuat Data Stok...</div>}
                    
                    {!loadingSnapshots && (
                        <>
                            {/* --- DESKTOP GRID VIEW --- */}
                            <div ref={gridRef} className="hidden md:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {visibleProducts.map(p => (
                                    <div key={p.id} className="card-luxury p-5 cursor-grab active:cursor-grabbing hover:border-lumina-gold/50 transition-all relative group" onClick={() => openModal(p)}>
                                        <span className="text-[10px] font-bold bg-surface text-lumina-gold px-2 py-1 rounded uppercase tracking-wide border border-lumina-border">{p.base_sku}</span>
                                        <h3 className="text-sm font-bold text-text-primary mt-3 mb-4 line-clamp-2 leading-relaxed group-hover:text-lumina-gold transition-colors">{p.name}</h3>
                                        <div className="flex justify-between items-end border-t border-lumina-border pt-3">
                                            <span className="text-xs text-text-secondary">{p.variants.length} Items</span>
                                            <span className={`text-lg font-bold ${p.totalStock > 0 ? 'text-emerald-400' : 'text-lumina-border'}`}>{p.totalStock}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* --- MOBILE LIST VIEW (ACCORDION) --- */}
                            <div className="md:hidden grid grid-cols-1 gap-4">
                                {visibleProducts.map(p => {
                                    const isExpanded = expandedProductId === p.id;
                                    return (
                                        <div key={p.id} onClick={() => openModal(p)} className="card-luxury p-4 active:scale-[0.98] transition-transform cursor-pointer">
                                            <div className="flex gap-4 items-start">
                                                <div className="w-16 h-16 rounded-lg bg-surface border border-lumina-border flex-shrink-0 overflow-hidden">
                                                    {p.image_url ? (
                                                        <img src={p.image_url} alt="Product" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-text-secondary"><span className="text-xs">IMG</span></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-xs font-mono font-bold text-lumina-gold bg-surface px-1.5 py-0.5 rounded border border-lumina-border">{p.base_sku}</span>
                                                        <span className={`text-sm font-bold font-mono ${p.totalStock > 0 ? 'text-emerald-400' : 'text-text-secondary/50'}`}>
                                                            {p.totalStock} <span className="text-[10px] font-normal">qty</span>
                                                        </span>
                                                    </div>
                                                    <h3 className="text-sm font-bold text-text-primary mt-1 truncate">{p.name}</h3>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-[10px] text-text-secondary">{p.variants.length} Varian</span>
                                                        <span className="badge-luxury badge-neutral text-[9px]">{p.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Update Stock Modal */}
            <Portal>
            {modalOpen && currentModalProd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-surface border border-lumina-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col ring-1 ring-lumina-gold/20">
                        
                        {/* MODAL HEADER COMPACT */}
                        <div className="p-4 border-b border-lumina-border bg-surface rounded-t-2xl flex flex-col gap-3 shrink-0">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-text-primary font-mono tracking-wide">{currentModalProd.base_sku}</h3>
                                    <p className="text-sm text-text-secondary truncate mt-0.5">{currentModalProd.name}</p>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                    <button onClick={() => setModalOpen(false)} className="text-xl text-text-secondary hover:text-text-primary transition-colors px-2 -mr-2">&times;</button>
                                    {/* Grouping Controls */}
                                    <div className="flex items-center bg-surface/50 rounded-lg border border-lumina-border/30 p-0.5">
                                        <button 
                                            onClick={() => setGroupBy('size')} 
                                            className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${groupBy==='size' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-primary'}`}
                                        >
                                            Size
                                        </button>
                                        <button 
                                            onClick={() => setGroupBy('color')} 
                                            className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${groupBy==='color' ? 'bg-primary text-black' : 'text-text-secondary hover:text-text-primary'}`}
                                        >
                                            Color
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* MODAL BODY (SCROLLABLE) */}
                        <div className="flex-1 overflow-y-auto p-0 bg-surface custom-scrollbar">
                            {(() => {
                                const groups = getGroupedVariants(currentModalProd.variants);
                                const sortedKeys = Object.keys(groups).sort((a,b) => {
                                     if(groupBy === 'size') {
                                         const sizes = ['XXS','XS','S','M','L','XL','XXL','2XL','3XL','ALL','STD'];
                                         const iA = sizes.indexOf(a.toUpperCase());
                                         const iB = sizes.indexOf(b.toUpperCase());
                                         if(iA !== -1 && iB !== -1) return iA - iB;
                                         return a.localeCompare(b);
                                     }
                                     return a.localeCompare(b);
                                });

                                return (
                                    <div className="divide-y divide-lumina-border/30">
                                        {sortedKeys.map(key => (
                                            <div key={key}>
                                                {/* Group Header */}
                                                <div className="bg-surface/50 px-4 py-2 text-[10px] font-extrabold text-lumina-gold uppercase tracking-widest border-y border-lumina-border/50 sticky top-0 z-10">
                                                    {groupBy === 'size' ? `Size: ${key}` : `Color: ${key}`}
                                                </div>

                                                {/* Variants in Group */}
                                                {groups[key]
                                                    .sort((a,b) => groupBy === 'size' ? a.color.localeCompare(b.color) : sortBySize(a, b))
                                                    .map(v => {
                                                        const whId = warehouses.find(w => w.supplier_id === selectedSupplierId)?.id;
                                                        const sysQty = snapshots[`${v.id}_${whId}`]?.qty || 0;
                                                        const inputVal = modalUpdates[v.id];
                                                        const isUpdated = inputVal !== undefined && inputVal !== "" && parseInt(inputVal) !== sysQty;
                                                        
                                                        return (
                                                            <div key={v.id} className={`p-4 flex flex-col gap-3 transition-colors border-b border-lumina-border/10 last:border-0 ${isUpdated ? 'bg-primary/5' : ''}`}>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-bold text-text-primary">
                                                                            {groupBy === 'size' ? v.color : v.size} 
                                                                            <span className="text-text-secondary font-normal ml-1 text-xs">/ {groupBy === 'size' ? v.size : v.color}</span>
                                                                        </span>
                                                                        <span className="text-[10px] font-mono text-text-secondary mt-0.5">{v.sku}</span>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-[10px] text-text-secondary block uppercase">System</span>
                                                                        <span className="font-mono text-sm font-bold text-text-primary">{sysQty}</span>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* Input & Quick Actions */}
                                                                <div className="flex items-center gap-2">
                                                                    <input 
                                                                        type="number" 
                                                                        className={`flex-1 text-center bg-surface border rounded-lg py-2 font-bold text-lg focus:ring-2 outline-none transition-all ${
                                                                            isUpdated 
                                                                            ? 'border-lumina-gold text-lumina-gold ring-lumina-gold/30' 
                                                                            : 'border-lumina-border text-text-primary ring-transparent focus:border-lumina-gold'
                                                                        }`} 
                                                                        placeholder={sysQty}
                                                                        value={modalUpdates[v.id] || ''}
                                                                        onChange={(e) => setModalUpdates({...modalUpdates, [v.id]: e.target.value})} 
                                                                    />
                                                                    
                                                                    {/* Helper Buttons */}
                                                                    <div className="flex gap-1">
                                                                        <button onClick={() => quickSet(v.id, sysQty)} className="px-3 py-2 bg-surface border border-lumina-border rounded text-[10px] font-bold hover:bg-lumina-highlight text-text-secondary">=</button>
                                                                        <button onClick={() => quickSet(v.id, 0)} className="px-3 py-2 bg-surface border border-lumina-border rounded text-[10px] font-bold hover:bg-lumina-highlight text-text-secondary">0</button>
                                                                        <button onClick={() => quickSet(v.id, 1, 'add')} className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] font-bold hover:bg-emerald-500/20 text-emerald-400">+1</button>
                                                                        <button onClick={() => quickSet(v.id, 5, 'add')} className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] font-bold hover:bg-emerald-500/20 text-emerald-400">+5</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <div className="p-4 border-t border-lumina-border bg-surface rounded-b-2xl flex justify-end gap-3 shrink-0">
                             <button onClick={() => setModalOpen(false)} className="btn-ghost-dark flex-1 md:flex-none">Batal</button>
                            <button 
                                onClick={saveModal} 
                                disabled={!hasChanges}
                                className={`btn-gold flex-1 md:flex-none shadow-gold-glow transition-all ${!hasChanges ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                            >
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}