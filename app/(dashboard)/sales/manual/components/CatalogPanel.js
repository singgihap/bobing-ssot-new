"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, RotateCcw, Package, Tag, Sparkles } from 'lucide-react';
import Fuse from 'fuse.js';
import { motion } from 'framer-motion';
import Skeleton from '@/components/Skeleton';

export default function CatalogPanel({ 
    products, categories, collections, warehouses, 
    selectedWh, setSelectedWh, 
    snapshots, cart, onSelectProduct, onRefresh, loading 
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeCollection, setActiveCollection] = useState('all');
    const searchInputRef = useRef(null);

    // Keyboard Shortcut F2
    useEffect(() => {
        const handleKey = (e) => { if(e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); } };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    // Recursive Category Helper
    const getCategoryFamily = (parentId, allCats) => {
        let ids = [parentId];
        allCats.filter(c => c.parent_id === parentId).forEach(child => {
            ids = [...ids, ...getCategoryFamily(child.id, allCats)];
        });
        return ids;
    };

    // Filter Logic
    const filteredProducts = useMemo(() => {
        let res = products;
        if (activeCategory !== 'all') {
            const familyIds = getCategoryFamily(activeCategory, categories);
            res = res.filter(p => familyIds.includes(p.category_id));
        }
        if (activeCollection !== 'all') {
            res = res.filter(p => p.collection_id === activeCollection);
        }
        if (searchTerm) {
            const fuse = new Fuse(res, { keys: ['name', 'base_sku', 'brand_name'], threshold: 0.4 });
            res = fuse.search(searchTerm).map(r => r.item);
        }
        return res.slice(0, 100);
    }, [searchTerm, products, activeCategory, activeCollection, categories]);

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Header & Controls */}
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center gap-2">
                    <div>
                        <h1 className="text-xl font-display font-bold text-text-primary">Point of Sales</h1>
                        <p className="text-[10px] text-text-secondary font-medium">Kasir & Transaksi</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onRefresh} className="bg-white hover:bg-gray-50 border border-border rounded-xl w-10 h-10 flex items-center justify-center shadow-sm">
                            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <select className="input-luxury py-2.5 text-xs font-bold w-40" value={selectedWh} onChange={e=>setSelectedWh(e.target.value)}>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Search & Chips */}
                <div className="space-y-2">
                    <div className="relative w-full group">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 group-focus-within:text-primary transition-colors" />
                        <input 
                            ref={searchInputRef} type="text" 
                            className="input-luxury pl-10" 
                            placeholder="Cari Produk / Scan Barcode (F2)..." 
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button onClick={() => { setActiveCategory('all'); setActiveCollection('all'); }} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${activeCategory === 'all' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-text-secondary border-border'}`}>All</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${activeCategory === cat.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-text-secondary border-border'}`}>
                                <Tag className="w-3 h-3"/> {cat.name}
                            </button>
                        ))}
                        {collections.map(col => (
                            <button key={col.id} onClick={() => setActiveCollection(activeCollection === col.id ? 'all' : col.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${activeCollection === col.id ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-text-secondary border-border'}`}>
                                <Sparkles className="w-3 h-3"/> {col.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-24 lg:pb-0">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 content-start">
                    {loading ? <div className="col-span-full text-center py-20 text-text-secondary animate-pulse">Memuat Katalog...</div> : 
                     filteredProducts.length === 0 ? <div className="col-span-full text-center py-20 text-text-secondary flex flex-col items-center"><Package className="w-12 h-12 mb-2 opacity-20"/>Produk tidak ditemukan</div> :
                     filteredProducts.map((p, idx) => {
                        const stock = p.variants.reduce((a,b) => a + (snapshots[`${b.id}_${selectedWh}`] || 0), 0);
                        const cartQty = cart.reduce((acc, item) => (p.variants.some(v => v.id === item.id) ? acc + item.qty : acc), 0);

                        return (
                            <motion.div 
                                key={p.id} onClick={() => onSelectProduct(p)} 
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                                className={`bg-white rounded-2xl cursor-pointer border border-border hover:border-primary hover:shadow-lg transition-all flex flex-col justify-between group overflow-hidden h-full relative ${stock<=0?'opacity-60 grayscale':''}`}
                            >
                                {cartQty > 0 && <div className="absolute top-2 right-2 z-10 bg-primary text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md animate-bounce">{cartQty}</div>}
                                <div className="p-4 flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-mono font-bold text-text-secondary bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{p.base_sku}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${stock>0?'text-emerald-700 bg-emerald-50 border border-emerald-100':'text-rose-700 bg-rose-50 border border-rose-100'}`}>{stock}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-text-primary group-hover:text-primary leading-snug line-clamp-2">{p.name}</h4>
                                </div>
                                <div className="px-4 py-3 bg-gray-50/80 border-t border-border flex justify-between items-center text-xs">
                                    <span className="text-text-secondary font-medium truncate max-w-[60%]">{p.brand_name}</span>
                                    <div className="flex items-center gap-1 text-primary font-bold bg-white px-2 py-0.5 rounded-md border border-border shadow-sm">
                                        <span>{p.variants.length}</span><span className="text-[9px] uppercase text-text-secondary font-normal">Var</span>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}