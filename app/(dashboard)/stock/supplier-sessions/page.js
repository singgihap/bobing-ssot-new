"use client";
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, serverTimestamp, limit, where, updateDoc } from 'firebase/firestore';
// UPDATE: Import sizeRank untuk sorting Header Group
import { sortBySize, sizeRank } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import React from 'react'; 

// Cache Configuration
const CACHE_KEY = 'lumina_virtual_stock_master';
const CACHE_DURATION = 5 * 60 * 1000; // 5 Menit

export default function VirtualStockPage() {
    // Data State
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [variants, setVariants] = useState([]);
    
    // Snapshot diload lazy
    const [snapshots, setSnapshots] = useState({});
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);
    
    // UI State
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isRackMode, setIsRackMode] = useState(true);
    
    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [currentModalProd, setCurrentModalProd] = useState(null);
    const [tempStock, setTempStock] = useState({}); 
    
    // Modal Sorting State (Default 'size')
    const [modalSortMode, setModalSortMode] = useState('size'); 

    // --- 1. INITIAL LOAD ---
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                let loaded = false;
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.ts < CACHE_DURATION) {
                        setSuppliers(parsed.suppliers);
                        setWarehouses(parsed.warehouses);
                        setProducts(parsed.products);
                        setVariants(parsed.variants);
                        const defWh = parsed.warehouses.find(w => w.name.toLowerCase().includes('kuning')) || parsed.warehouses[0];
                        if (defWh && !selectedSupplierId) setSelectedSupplierId(defWh.id);
                        loaded = true;
                    }
                }

                if (!loaded) {
                    const [whSnap, prodSnap, varSnap] = await Promise.all([
                        getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                        getDocs(collection(db, "products")),
                        getDocs(collection(db, "product_variants"))
                    ]);

                    const whList = [];
                    whSnap.forEach(d => whList.push({ id: d.id, ...d.data() }));
                    const prodList = []; prodSnap.forEach(d => prodList.push({id:d.id, ...d.data()}));
                    const varList = []; varSnap.forEach(d => varList.push({id:d.id, ...d.data()}));

                    setWarehouses(whList);
                    setProducts(prodList);
                    setVariants(varList);
                    
                    const defWh = whList.find(w => w.name.toLowerCase().includes('kuning')) || whList[0];
                    if (defWh && !selectedSupplierId) setSelectedSupplierId(defWh.id);

                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        suppliers: [], warehouses: whList, products: prodList, variants: varList, ts: Date.now()
                    }));
                }
            } catch(e) { console.error(e); } finally { setLoading(false); }
        };
        init();
    }, []);

    // --- 2. LOAD SNAPSHOTS ---
    useEffect(() => {
        if (!selectedSupplierId) return;
        const loadStock = async () => {
            setLoadingSnapshots(true);
            try {
                const q = query(collection(db, "stock_snapshots"), where("warehouse_id", "==", selectedSupplierId));
                const snap = await getDocs(q);
                const map = {};
                snap.forEach(d => { map[d.data().variant_id] = d.data().qty || 0; });
                setSnapshots(map);
            } catch(e) { console.error(e); } finally { setLoadingSnapshots(false); }
        };
        loadStock();
    }, [selectedSupplierId]);

    const handleUpdateRack = async (prodId, newRack) => {
        const cleanRack = newRack.toUpperCase().trim();
        setProducts(prev => prev.map(p => p.id === prodId ? { ...p, rack: cleanRack } : p));
        try {
            await updateDoc(doc(db, "products", prodId), { rack: cleanRack });
            toast.success(`Rak disimpan: ${cleanRack}`, { duration: 1000, icon: '📍' });
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                parsed.products = parsed.products.map(p => p.id === prodId ? { ...p, rack: cleanRack } : p);
                localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
            }
        } catch (e) { toast.error("Gagal simpan rak"); }
    };

    // --- OPEN MODAL ---
    const openScreening = (prod) => {
        const prodVars = variants.filter(v => v.product_id === prod.id);
        const initialTemp = {};
        prodVars.forEach(v => { initialTemp[v.id] = snapshots[v.id] || 0; });

        setCurrentModalProd({ ...prod, variants: prodVars });
        setTempStock(initialTemp);
        setModalSortMode('size'); // DEFAULT SORT BY SIZE
        setModalOpen(true);
    };

    const updateTemp = (variantId, type) => {
        setTempStock(prev => {
            const current = prev[variantId] || 0;
            let newVal = current;
            if (type === 'zero') newVal = 0;
            else if (type === 'add_5') newVal += 5;
            else if (type === 'add_10') newVal += 10;
            else if (type === 'min_1') newVal = Math.max(0, current - 1);
            else if (type === 'plus_1') newVal += 1;
            return { ...prev, [variantId]: newVal };
        });
    };

    const saveModal = async () => {
        if (!selectedSupplierId || !currentModalProd) return;

        let hasChanges = false;
        const updates = [];

        currentModalProd.variants.forEach(v => {
            const oldQty = snapshots[v.id] || 0;
            const newQty = tempStock[v.id];
            if (oldQty !== newQty) {
                hasChanges = true;
                updates.push({ variantId: v.id, diff: newQty - oldQty, newQty });
            }
        });

        if (!hasChanges) { setModalOpen(false); return; }

        try {
            await runTransaction(db, async (transaction) => {
                updates.forEach(u => {
                    const moveRef = doc(collection(db, "stock_movements"));
                    transaction.set(moveRef, {
                        variant_id: u.variantId, warehouse_id: selectedSupplierId,
                        type: 'virtual_adjustment', qty: u.diff, date: serverTimestamp(),
                        notes: 'Screening Gudang Supplier', created_by: 'app_user'
                    });
                    const snapRef = doc(db, "stock_snapshots", `${u.variantId}_${selectedSupplierId}`);
                    transaction.set(snapRef, {
                        id: `${u.variantId}_${selectedSupplierId}`, variant_id: u.variantId,
                        warehouse_id: selectedSupplierId, qty: u.newQty, updated_at: serverTimestamp()
                    }, { merge: true });
                });
            });

            setSnapshots(prev => {
                const next = { ...prev };
                updates.forEach(u => next[u.variantId] = u.newQty);
                return next;
            });

            setModalOpen(false);
            toast.success("Stok Terupdate!", { icon: '✅' });
        } catch(e) {
            console.error(e);
            toast.error("Gagal menyimpan");
        }
    };

    const filteredProducts = products
        .filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.base_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.rack || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (isRackMode) {
                const rackA = a.rack || 'ZZZ'; 
                const rackB = b.rack || 'ZZZ';
                if (rackA < rackB) return -1;
                if (rackA > rackB) return 1;
            }
            return a.name.localeCompare(b.name);
        });

    // COMPONENT: QUICK CONTROL ROW
    // mode='size' -> Header=SizeName, ItemText=ColorName
    // mode='color' -> Header=ColorName, ItemText=SizeName
    const QuickControlRow = ({ v, qty, mode }) => (
        <div className="flex items-center justify-between mb-3 last:mb-0 bg-white p-2 rounded-lg border border-lumina-border shadow-sm">
            <div className="w-1/3">
                {/* Jika Group by Size, tampilkan Warna di sini. Sebaliknya jika Group by Color, tampilkan Size. */}
                <div className="font-bold text-base text-text-primary">
                    {mode === 'size' ? v.color : v.size}
                </div>
                <div className="text-[10px] text-text-secondary font-mono">{v.sku}</div>
            </div>
            
            <div className="flex items-center gap-2">
                <button onClick={() => updateTemp(v.id, 'zero')} className="h-9 px-2 text-[10px] font-bold bg-rose-50 text-rose-600 rounded border border-rose-200 hover:bg-rose-100 active:scale-95">NOL</button>
                
                <div className="flex items-center bg-background border border-lumina-border rounded-lg h-9">
                    <button onClick={() => updateTemp(v.id, 'min_1')} className="w-9 h-full flex items-center justify-center text-text-secondary hover:bg-gray-200 rounded-l-lg active:bg-gray-300 text-lg font-bold">-</button>
                    <input 
                        type="number" 
                        className="w-10 text-center bg-transparent font-bold text-primary outline-none text-lg"
                        value={qty}
                        onChange={(e) => setTempStock({...tempStock, [v.id]: parseInt(e.target.value)||0})}
                    />
                    <button onClick={() => updateTemp(v.id, 'plus_1')} className="w-9 h-full flex items-center justify-center text-text-secondary hover:bg-gray-200 rounded-r-lg active:bg-gray-300 text-lg font-bold">+</button>
                </div>

                <div className="flex flex-col gap-1">
                    <button onClick={() => updateTemp(v.id, 'add_5')} className="px-2 py-0.5 text-[9px] font-bold bg-blue-50 border border-blue-200 text-blue-600 rounded hover:bg-blue-100 active:scale-95">+5</button>
                    <button onClick={() => updateTemp(v.id, 'add_10')} className="px-2 py-0.5 text-[9px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-600 rounded hover:bg-emerald-100 active:scale-95">+10</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto pb-24 px-4 pt-4 bg-background min-h-screen">
            {/* --- HEADER --- */}
            <div className="sticky top-0 z-10 bg-background pb-4 space-y-3">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-text-primary">Stok Virtual</h1>
                        <p className="text-xs text-text-secondary">Screening & Belanja Cepat.</p>
                    </div>
                    <button onClick={() => setIsRackMode(!isRackMode)} className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors flex items-center gap-2 ${isRackMode ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-lumina-border'}`}>
                        {isRackMode ? '📍 Urut Rak' : '🔤 Urut Nama'}
                    </button>
                </div>

                <div className="bg-surface p-3 rounded-xl border border-lumina-border shadow-sm">
                    <label className="text-[10px] font-bold text-text-secondary uppercase mb-1 block">Lokasi Belanja (Gudang)</label>
                    <select className="w-full bg-background border border-lumina-border rounded-lg p-2 text-sm font-bold text-text-primary focus:outline-none focus:border-primary" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                        <option value="">-- Pilih Supplier --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>

                <div className="relative">
                    <input type="text" className="w-full pl-10 pr-4 py-3 bg-surface border border-lumina-border rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Cari SKU / Nama / Rak..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <svg className="w-5 h-5 text-text-secondary absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
            </div>

            {/* --- GRID PRODUK --- */}
            {!selectedSupplierId ? (
                <div className="text-center py-20 text-text-secondary opacity-50"><p>Pilih Gudang Supplier dulu di atas 👆</p></div>
            ) : loadingSnapshots ? (
                <div className="text-center py-20 text-primary animate-pulse">Memuat data stok...</div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredProducts.map(p => {
                        const pVars = variants.filter(v => v.product_id === p.id);
                        const totalStock = pVars.reduce((acc, v) => acc + (snapshots[v.id] || 0), 0);
                        
                        return (
                            <div key={p.id} onClick={() => openScreening(p)} className="bg-surface p-4 rounded-xl border border-lumina-border shadow-sm active:scale-[0.98] transition-transform flex gap-3 cursor-pointer relative group">
                                {/* RACK INPUT */}
                                <div className="shrink-0 flex flex-col items-center justify-center gap-1 border-r border-dashed border-lumina-border pr-3 w-16" onClick={e => e.stopPropagation()}>
                                    <span className="text-[9px] text-text-secondary uppercase font-bold">RAK</span>
                                    <input type="text" className="w-full text-center font-mono font-bold text-lg bg-gray-50 border border-lumina-border rounded p-1 uppercase focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-primary" placeholder="--" defaultValue={p.rack || ''} onBlur={(e) => handleUpdateRack(p.id, e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') e.target.blur(); }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {/* SKU BASE: HIGHLIGHTED */}
                                        <span className="font-mono text-sm font-black bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm tracking-wide">{p.base_sku}</span>
                                        {totalStock > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">{totalStock} pcs</span>}
                                    </div>
                                    <h3 className="font-bold text-text-primary text-sm leading-tight line-clamp-2">{p.name}</h3>
                                    <p className="text-xs text-text-secondary mt-1">{pVars.length} Varian</p>
                                </div>
                                <div className="self-center w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg></div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- SCREENING MODAL --- */}
            <Portal>
            {modalOpen && currentModalProd && (
                <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-slide-up">
                    <div className="bg-surface w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        
                        {/* MODAL HEADER */}
                        <div className="p-4 border-b border-lumina-border bg-surface rounded-t-2xl flex justify-between items-start shadow-sm z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">RAK: {currentModalProd.rack || '-'}</span>
                                    <span className="font-mono text-sm font-extrabold text-primary">{currentModalProd.base_sku}</span>
                                </div>
                                <h3 className="font-bold text-lg text-text-primary leading-tight line-clamp-1">{currentModalProd.name}</h3>
                            </div>
                            
                            {/* SORT TOGGLE */}
                            <div className="flex flex-col items-end gap-2">
                                <button onClick={() => setModalOpen(false)} className="text-text-secondary p-1 bg-gray-100 rounded-full hover:bg-gray-200">✕</button>
                                <button onClick={() => setModalSortMode(modalSortMode === 'size' ? 'color' : 'size')} className="text-[10px] font-bold px-2 py-1 rounded border border-lumina-border bg-gray-50 hover:bg-gray-100 transition-colors flex items-center gap-1">
                                    <span>Group:</span><span className="text-primary uppercase">{modalSortMode}</span>
                                </button>
                            </div>
                        </div>

                        {/* VARIANT LIST (DYNAMIC GROUPING) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50 custom-scrollbar">
                            {modalSortMode === 'size' ? (
                                // --- MODE 1: GROUP BY SIZE (DEFAULT) ---
                                <div className="space-y-4">
                                    {Object.entries(
                                        currentModalProd.variants.reduce((acc, v) => {
                                            const k = (v.size || 'No Size').toUpperCase();
                                            if(!acc[k]) acc[k] = [];
                                            acc[k].push(v);
                                            return acc;
                                        }, {})
                                    ).sort((a, b) => {
                                        // Sort Group Headers (Size) Using sizeRank
                                        const idxA = sizeRank.indexOf(a[0]);
                                        const idxB = sizeRank.indexOf(b[0]);
                                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                        if (idxA !== -1) return -1;
                                        if (idxB !== -1) return 1;
                                        return a[0].localeCompare(b[0]);
                                    }).map(([size, vars]) => (
                                        <div key={size} className="bg-surface p-3 rounded-xl border border-lumina-border shadow-sm">
                                            <h4 className="text-xs font-bold text-text-secondary uppercase mb-3 border-b border-dashed border-lumina-border pb-1 flex justify-between">
                                                <span>{size}</span>
                                                <span className="text-[10px] bg-gray-100 px-1.5 rounded">{vars.length} Item</span>
                                            </h4>
                                            {/* Items: Sorted by Color */}
                                            {vars.sort((a,b) => (a.color||'').localeCompare(b.color||'')).map(v => (
                                                <QuickControlRow key={v.id} v={v} qty={tempStock[v.id] || 0} mode="size" />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                // --- MODE 2: GROUP BY COLOR ---
                                <div className="space-y-4">
                                    {Object.entries(
                                        currentModalProd.variants.reduce((acc, v) => {
                                            const k = v.color || 'General';
                                            if(!acc[k]) acc[k] = [];
                                            acc[k].push(v);
                                            return acc;
                                        }, {})
                                    ).sort().map(([color, vars]) => (
                                        <div key={color} className="bg-surface p-3 rounded-xl border border-lumina-border shadow-sm">
                                            <h4 className="text-xs font-bold text-text-secondary uppercase mb-3 border-b border-dashed border-lumina-border pb-1 flex justify-between">
                                                <span>{color}</span>
                                                <span className="text-[10px] bg-gray-100 px-1.5 rounded">{vars.length} Item</span>
                                            </h4>
                                            {/* Items: Sorted by Size (Custom Logic) */}
                                            {vars.sort(sortBySize).map(v => (
                                                <QuickControlRow key={v.id} v={v} qty={tempStock[v.id] || 0} mode="color" />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="p-4 border-t border-lumina-border bg-surface rounded-b-2xl flex justify-between items-center shrink-0">
                            <div className="text-xs text-text-secondary">
                                Total: <span className="font-bold text-xl text-primary ml-1">{Object.values(tempStock).reduce((a,b)=>a+b,0)}</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setModalOpen(false)} className="btn-ghost-dark px-4 py-2 text-sm">Batal</button>
                                <button onClick={saveModal} className="btn-gold px-6 py-2 text-sm shadow-lg">SIMPAN</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}