"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, limit } from 'firebase/firestore';
import { sortBySize, formatRupiah } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

import { Search, Plus, Filter, Edit, Wand2, Box, Tag, Ruler } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CACHE_KEY_VARIANTS = 'lumina_variants_v2';
const CACHE_KEY_PRODUCTS = 'lumina_products_data_v2'; 
const CACHE_DURATION = 30 * 60 * 1000;

export default function VariantsPage() {
    const [variants, setVariants] = useState([]);
    const [products, setProducts] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBaseSku, setSelectedBaseSku] = useState('-');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            let cachedProducts = null;
            let cachedVariants = null;

            if (!forceRefresh && typeof window !== 'undefined') {
                const rawProd = localStorage.getItem(CACHE_KEY_PRODUCTS);
                const rawVar = localStorage.getItem(CACHE_KEY_VARIANTS);

                if (rawProd) {
                    const parsed = JSON.parse(rawProd);
                    const prodData = Array.isArray(parsed) ? parsed : (parsed.products || []);
                    if (Date.now() - (parsed.timestamp || 0) < CACHE_DURATION) cachedProducts = prodData;
                }
                if (rawVar) {
                    const parsed = JSON.parse(rawVar);
                    if (Date.now() - parsed.timestamp < CACHE_DURATION) cachedVariants = parsed.data;
                }
            }

            const promises = [];
            if (cachedProducts) setProducts(cachedProducts);
            else promises.push(getDocs(query(collection(db, "products"), orderBy("name"))));

            if (cachedVariants) setVariants(cachedVariants);
            else promises.push(getDocs(query(collection(db, "product_variants"), orderBy("sku"), limit(100))));

            if (promises.length > 0) {
                const results = await Promise.all(promises);
                let prodIdx = 0;

                if (!cachedProducts) {
                    const snapProd = results[prodIdx++];
                    const ps = [];
                    snapProd.forEach(d => ps.push({id:d.id, name: d.data().name, base_sku: d.data().base_sku})); 
                    setProducts(ps);
                    if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify({ products: ps, timestamp: Date.now() }));
                }

                if (!cachedVariants) {
                    const snapVar = results[prodIdx];
                    const vs = [];
                    snapVar.forEach(d => vs.push({id:d.id, ...d.data()}));
                    setVariants(vs);
                    if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY_VARIANTS, JSON.stringify({ data: vs, timestamp: Date.now() }));
                }
            }
        } catch(e) { console.error(e); toast.error("Gagal memuat data"); } finally { setLoading(false); }
    };
    
    const handleParentChange = (e) => { 
        const p = products.find(x=>x.id===e.target.value); 
        setFormData({...formData, product_id: e.target.value}); 
        setSelectedBaseSku(p?p.base_sku:'-'); 
    };

    const generateSku = () => {
        const c = formData.color?.toUpperCase().replace(/\s/g,'-'); 
        const s = formData.size?.toUpperCase().replace(/\s/g,'-');
        if(selectedBaseSku!=='-' && c && s) {
            const newSku = `${selectedBaseSku}-${c}-${s}`;
            setFormData({...formData, sku: newSku});
            toast.success(`SKU Generated: ${newSku}`, {icon: '🪄'});
        } else {
            toast.error("Pilih Produk Induk, Warna, dan Size dulu.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const toastId = toast.loading("Menyimpan SKU...");
        try {
            const pl = {
                ...formData, updated_at: serverTimestamp(), 
                weight: Number(formData.weight)||0, cost: Number(formData.cost), price: Number(formData.price)
            };
            
            if(formData.id) await updateDoc(doc(db,"product_variants",formData.id), pl); 
            else { pl.created_at=serverTimestamp(); await addDoc(collection(db,"product_variants"), pl); }
            
            if (typeof window !== 'undefined') {
                localStorage.removeItem(CACHE_KEY_VARIANTS);
                localStorage.removeItem('lumina_inventory_v2'); 
                localStorage.removeItem('lumina_products_variants_v2');
            }

            setModalOpen(false); 
            toast.success("Berhasil disimpan!", { id: toastId });
            fetchData(true);
        } catch(e){ console.error(e); toast.error(`Gagal: ${e.message}`, { id: toastId }); }
    };

    const filteredVariants = variants.filter(v => 
        v.sku.toUpperCase().includes(searchTerm.toUpperCase()) ||
        (products.find(p=>p.id===v.product_id)?.name || '').toUpperCase().includes(searchTerm.toUpperCase())
    );

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 text-text-primary bg-background min-h-screen">
            <PageHeader 
                title="Master SKU (Variant)" 
                subtitle="Database semua varian produk (Warna, Ukuran, Harga)."
                actions={
                    <div className="flex gap-3 items-center">
                        <div className="relative w-64 group">
                            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3 group-focus-within:text-primary transition-colors" />
                            <input 
                                className="w-full pl-10 py-2.5 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                                placeholder="Cari SKU / Parent Product..." 
                                value={searchTerm} 
                                onChange={e=>setSearchTerm(e.target.value)} 
                            />
                        </div>
                        <button 
                            onClick={() => { setFormData({ product_id:'', sku:'', color:'', size:'', cost:0, price:0, status:'active' }); setSelectedBaseSku('-'); setModalOpen(true); }} 
                            className="btn-gold flex items-center gap-2 shadow-lg"
                        >
                            <Plus className="w-4 h-4 stroke-[3px]" /> Add SKU
                        </button>
                    </div>
                }
            />

            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/80 sticky top-0 z-10 text-[11px] font-bold text-text-secondary uppercase tracking-wider backdrop-blur-sm border-b border-border">
                            <tr>
                                <th className="pl-6 py-4">SKU Code</th>
                                <th className="py-4">Parent Product</th>
                                <th className="py-4">Spec (Color/Size)</th>
                                <th className="py-4 text-right">Sell Price</th>
                                <th className="py-4 text-right pr-6">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-text-primary divide-y divide-border/60">
                            {loading ? (
                                <tr><td colSpan="5" className="p-12 text-center text-text-secondary animate-pulse">Loading variants...</td></tr>
                            ) : filteredVariants.length === 0 ? (
                                <tr><td colSpan="5" className="p-12 text-center text-text-secondary">No variants found.</td></tr>
                            ) : (
                                filteredVariants.map(v=>(
                                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="pl-6 py-3 font-mono text-primary font-bold text-xs">{v.sku}</td>
                                        <td className="py-3 text-text-primary text-sm">{products.find(p=>p.id===v.product_id)?.name || '-'}</td>
                                        <td className="py-3">
                                            <div className="flex gap-2">
                                                <span className="text-[10px] bg-gray-100 text-text-secondary px-2 py-0.5 rounded border border-border flex items-center gap-1"><Tag className="w-3 h-3"/> {v.color}</span>
                                                <span className="text-[10px] bg-gray-100 text-text-secondary px-2 py-0.5 rounded border border-border flex items-center gap-1"><Ruler className="w-3 h-3"/> {v.size}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-right font-bold text-text-primary font-mono">{formatRupiah(v.price)}</td>
                                        <td className="py-3 text-right pr-6">
                                            <button onClick={()=>{setFormData({...v}); const p = products.find(x=>x.id===v.product_id); setSelectedBaseSku(p?p.base_sku:'-'); setModalOpen(true);}} className="text-xs font-bold text-text-secondary hover:text-primary bg-white border border-border px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL --- */}
            <Portal>
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <h3 className="text-lg font-bold text-text-primary">{formData.id?'Edit SKU':'New SKU'}</h3>
                            <button onClick={()=>setModalOpen(false)} className="text-text-secondary hover:text-rose-500 transition-colors">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                <label className="text-xs font-bold text-blue-700 uppercase block mb-1">Parent Product</label>
                                <select className="input-luxury mt-1 w-full bg-white" value={formData.product_id} onChange={handleParentChange}>
                                    <option value="">-- Select Product --</option>
                                    {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <div className="text-xs text-blue-600 mt-2 font-mono flex items-center gap-1"><Box className="w-3 h-3"/> Base SKU: {selectedBaseSku}</div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="text-xs font-bold text-text-secondary block mb-1">Color</label><input className="input-luxury w-full" value={formData.color} onChange={e=>setFormData({...formData, color:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-text-secondary block mb-1">Size</label><input className="input-luxury w-full" value={formData.size} onChange={e=>setFormData({...formData, size:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-text-secondary block mb-1">Weight (g)</label><input type="number" className="input-luxury w-full" value={formData.weight} onChange={e=>setFormData({...formData, weight:e.target.value})}/></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">SKU Final</label>
                                    <div className="flex gap-2">
                                        <input className="input-luxury font-mono w-full font-bold text-primary" value={formData.sku} onChange={e=>setFormData({...formData, sku:e.target.value})} />
                                        <button onClick={generateSku} type="button" className="bg-primary/10 text-primary border border-primary/20 px-3 rounded-xl hover:bg-primary/20 transition-colors" title="Auto Generate"><Wand2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <div><label className="text-xs font-bold text-text-secondary block mb-1">Barcode</label><input className="input-luxury w-full" value={formData.barcode} onChange={e=>setFormData({...formData, barcode:e.target.value})}/></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-border">
                                <div><label className="text-xs font-bold text-rose-500 block mb-1">HPP (Cost)</label><input type="number" className="input-luxury w-full border-rose-200 text-rose-600 font-bold" value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-emerald-600 block mb-1">Sell Price</label><input type="number" className="input-luxury w-full border-emerald-200 text-emerald-600 font-bold" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})}/></div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
                            <button onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                            <button onClick={handleSubmit} className="btn-gold px-6 shadow-md">Save SKU</button>
                        </div>
                    </motion.div>
                </div>
            )}
            </Portal>
        </div>
    );
}