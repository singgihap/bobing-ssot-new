"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sortBySize, formatRupiah } from '@/lib/utils';
import imageCompression from 'browser-image-compression';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

// --- MODERN UI IMPORTS ---
import { 
    Search, Plus, Filter, MoreHorizontal, Edit, Trash2, 
    ChevronDown, ChevronRight, Image as ImageIcon, Box, Layers, Tag 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- KONFIGURASI CACHE ---
const CACHE_KEY_MAIN = 'lumina_products_data_v2'; 
const CACHE_KEY_VARIANTS = 'lumina_products_variants_v2'; 
const CACHE_DURATION = 30 * 60 * 1000; 

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [imageFile, setImageFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);
    
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [variantsCache, setVariantsCache] = useState({});
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { 
        if (typeof window !== 'undefined') {
            const cachedVars = localStorage.getItem(CACHE_KEY_VARIANTS);
            if (cachedVars) { try { setVariantsCache(JSON.parse(cachedVars)); } catch(e) {} }
        }
        fetchData(); 
    }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY_MAIN);
                if (cached) {
                    const { brands, categories, products, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setBrands(brands);
                        setCategories(categories);
                        setProducts(products);
                        setLoading(false);
                        return;
                    }
                }
            }

            const [snapBrands, snapCats, snapProds] = await Promise.all([
                getDocs(query(collection(db, "brands"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "products"), limit(100))) 
            ]);

            const bs = []; snapBrands.forEach(d => bs.push({id:d.id, ...d.data()}));
            const cs = []; snapCats.forEach(d => cs.push({id:d.id, ...d.data()}));
            const ps = []; 
            snapProds.forEach(d => { 
                const p=d.data(); 
                const b=bs.find(x=>x.id===p.brand_id); 
                ps.push({id:d.id, ...p, brand_name:b?b.name:''}); 
            });
            
            const sortedProducts = ps.sort((a,b)=>(a.base_sku||'').localeCompare(b.base_sku||''));

            setBrands(bs);
            setCategories(cs);
            setProducts(sortedProducts);

            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY_MAIN, JSON.stringify({
                    brands: bs, categories: cs, products: sortedProducts, timestamp: Date.now()
                }));
            }

        } catch(e) {
            console.error(e);
            toast.error("Gagal memuat data");
        } finally {
            setLoading(false);
        }
    };

    const toggleVariants = async (id) => {
        if(expandedProductId===id) { setExpandedProductId(null); return; }
        setExpandedProductId(id);
        
        if(!variantsCache[id]) {
            setLoadingVariants(true);
            try {
                const q = query(collection(db, "product_variants"), where("product_id", "==", id));
                const s = await getDocs(q); 
                const v=[]; 
                s.forEach(d=>v.push({id:d.id, ...d.data()}));
                
                const newCache = {...variantsCache, [id]:v};
                setVariantsCache(newCache);
                if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY_VARIANTS, JSON.stringify(newCache));
            } catch (e) {
                console.error("Failed to load variants", e);
                toast.error("Gagal memuat varian");
            } finally {
                setLoadingVariants(false);
            }
        }
    };

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) return toast.error('Harap upload file gambar.');
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const openModal = (p=null) => {
        setImageFile(null); setUploading(false); if(fileInputRef.current) fileInputRef.current.value="";
        if(p) { setFormData({...p}); setPreviewUrl(p.image_url||null); } 
        else { setFormData({brand_id:'', name:'', base_sku:'', category:'', status:'active'}); setPreviewUrl(null); }
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        setUploading(true);
        
        const savePromise = new Promise(async (resolve, reject) => {
            try {
                let url = formData.image_url;
                if(imageFile) {
                    const blob = await imageCompression(imageFile, {maxSizeMB:0.1, maxWidthOrHeight:800, fileType:'image/webp'}).catch(()=>imageFile);
                    const sRef = ref(storage, `products/${Date.now()}.webp`);
                    await uploadBytes(sRef, blob); url = await getDownloadURL(sRef);
                }
                const pl = {...formData, image_url: url||'', updated_at: serverTimestamp()};
                
                if(formData.id) {
                    await updateDoc(doc(db,"products",formData.id), pl); 
                } else { 
                    pl.created_at=serverTimestamp(); 
                    await addDoc(collection(db,"products"), pl); 
                }
                
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY_MAIN);
                
                setModalOpen(false); 
                fetchData(true); 
                resolve();
            } catch(e) { reject(e); }
        });

        toast.promise(savePromise, {
            loading: 'Menyimpan...',
            success: 'Produk disimpan!',
            error: (err) => `Gagal: ${err.message}`,
        }).finally(() => setUploading(false));
    };

    const deleteProduct = async (id) => { 
        if(confirm("Hapus?")) { 
            await deleteDoc(doc(db,"products",id)); 
            if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY_MAIN);
            fetchData(true); 
            toast.success("Produk dihapus");
        } 
    };
    
    const filtered = products.filter(p=>p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.base_sku.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 text-text-primary bg-background min-h-screen">
            
            {/* HEADER */}
            <PageHeader 
                title="Master Produk" 
                subtitle="Kelola katalog produk, varian, dan spesifikasi." 
                actions={
                    <div className="flex gap-3 items-center">
                        <div className="relative w-64 md:w-80 group">
                            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="text" 
                                className="w-full pl-10 py-2.5 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-text-primary placeholder:text-text-secondary transition-all shadow-sm"
                                placeholder="Cari Nama / SKU..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => openModal()} 
                            className="btn-gold flex items-center gap-2 shadow-lg hover:shadow-xl"
                        >
                            <Plus className="w-4 h-4 stroke-[3px]" /> Product
                        </button>
                    </div>
                }
            />

            {/* TABLE CARD */}
            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/80 sticky top-0 z-10 text-[11px] font-bold text-text-secondary uppercase tracking-wider backdrop-blur-sm border-b border-border">
                            <tr>
                                <th className="py-4 pl-6 w-16">Image</th>
                                <th className="py-4 px-4">Product Info</th>
                                <th className="py-4 px-4">SKU Induk</th>
                                <th className="py-4 px-4">Brand & Kategori</th>
                                <th className="py-4 px-4 text-center">Status</th>
                                <th className="py-4 px-4 text-right pr-6">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-text-primary divide-y divide-border/60">
                            {loading ? (
                                <tr><td colSpan="6" className="p-12 text-center text-text-secondary animate-pulse">Memuat data produk...</td></tr>
                            ) : filtered.map(p => {
                                const isExpanded = expandedProductId === p.id;
                                return (
                                    <React.Fragment key={p.id}>
                                        <tr 
                                            onClick={() => toggleVariants(p.id)} 
                                            className={`cursor-pointer transition-all hover:bg-gray-50/80 ${isExpanded ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <td className="py-3 pl-6">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-border flex items-center justify-center overflow-hidden">
                                                    {p.image_url ? (
                                                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageIcon className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-text-primary">{p.name}</div>
                                                <div className="flex items-center gap-1 mt-1 text-primary text-xs font-medium cursor-pointer hover:underline">
                                                    Lihat Varian {isExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="font-mono text-xs font-bold text-text-secondary bg-gray-100 px-2 py-1 rounded border border-border">{p.base_sku}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1 text-xs text-text-primary"><Tag className="w-3 h-3 text-text-secondary"/> {p.brand_name}</div>
                                                    <div className="flex items-center gap-1 text-xs text-text-secondary"><Layers className="w-3 h-3"/> {p.category}</div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${p.status==='active'?'bg-emerald-50 text-emerald-600 border-emerald-100':'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 pr-6 text-right">
                                                <div className="flex justify-end gap-2" onClick={e=>e.stopPropagation()}>
                                                    <button onClick={() => openModal(p)} className="p-2 text-text-secondary hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4"/></button>
                                                    <button onClick={() => deleteProduct(p.id)} className="p-2 text-text-secondary hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* EXPANDED VARIANTS */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.tr 
                                                    initial={{ opacity: 0, height: 0 }} 
                                                    animate={{ opacity: 1, height: 'auto' }} 
                                                    exit={{ opacity: 0, height: 0 }}
                                                >
                                                    <td colSpan="6" className="p-0 border-b border-border/50">
                                                        <div className="bg-gray-50/50 p-4 pl-20">
                                                            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-gray-50 text-[10px] uppercase text-text-secondary font-bold">
                                                                        <tr>
                                                                            <th className="px-4 py-2">Variant SKU</th>
                                                                            <th className="px-4 py-2">Spec (Warna/Size)</th>
                                                                            <th className="px-4 py-2 text-right">HPP</th>
                                                                            <th className="px-4 py-2 text-right">Harga Jual</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border/50">
                                                                        {loadingVariants ? (
                                                                            <tr><td colSpan="4" className="p-4 text-center text-xs text-text-secondary">Loading variants...</td></tr>
                                                                        ) : (variantsCache[p.id]||[]).sort(sortBySize).map(v => (
                                                                            <tr key={v.id}>
                                                                                <td className="px-4 py-2 font-mono text-xs font-bold text-primary">{v.sku}</td>
                                                                                <td className="px-4 py-2 text-text-secondary">{v.color} / {v.size}</td>
                                                                                <td className="px-4 py-2 text-right font-mono text-rose-500">{formatRupiah(v.cost)}</td>
                                                                                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">{formatRupiah(v.price)}</td>
                                                                            </tr>
                                                                        ))}
                                                                        {(!loadingVariants && (!variantsCache[p.id] || variantsCache[p.id].length === 0)) && (
                                                                             <tr><td colSpan="4" className="p-4 text-center text-xs text-text-secondary italic">Belum ada varian.</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL PRODUCT --- */}
            <Portal>
            {modalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-border">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-text-primary">{formData.id ? "Edit Produk" : "Produk Baru"}</h3>
                            <button onClick={() => setModalOpen(false)}><div className="p-1 rounded-full hover:bg-gray-100"><Trash2 className="w-5 h-5 text-gray-400 rotate-45"/></div></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Image Upload */}
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-dashed border-border group hover:border-primary/50 transition-colors">
                                <div className="w-20 h-20 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-border relative">
                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-300"/>}
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading}/>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Foto Produk</p>
                                    <p className="text-xs text-text-secondary mb-2">Format JPG/PNG, Max 2MB.</p>
                                    <label className="text-xs bg-white border border-border px-3 py-1.5 rounded-lg cursor-pointer hover:border-primary hover:text-primary transition-all font-medium shadow-sm">
                                        Pilih File
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={uploading}/>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">Brand</label>
                                    <select className="input-luxury" value={formData.brand_id} onChange={e=>setFormData({...formData, brand_id:e.target.value})}>
                                        <option value="">-- Pilih --</option>
                                        {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">SKU Induk</label>
                                    <input className="input-luxury font-mono uppercase" value={formData.base_sku} onChange={e=>setFormData({...formData, base_sku:e.target.value})} placeholder="CODE-001" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-text-secondary block mb-1">Nama Produk</label>
                                <input className="input-luxury" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="Contoh: Kemeja Flanel" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">Kategori</label>
                                    <select className="input-luxury" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                                        <option value="">-- Pilih --</option>
                                        {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">Status</label>
                                    <select className="input-luxury" value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value})}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border flex justify-end gap-3">
                                <button type="button" onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Batal</button>
                                <button type="submit" className="btn-gold px-6 shadow-md" disabled={uploading}>{uploading ? 'Menyimpan...' : 'Simpan Produk'}</button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
            </Portal>
        </div>
    );
}