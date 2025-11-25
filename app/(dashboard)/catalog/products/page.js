"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sortBySize, formatRupiah } from '@/lib/utils';
import imageCompression from 'browser-image-compression';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_KEY_MAIN = 'lumina_products_data_v2'; // Produk, Brand, Kategori
const CACHE_KEY_VARIANTS = 'lumina_products_variants_v2'; // Cache untuk varian per produk
const CACHE_DURATION = 30 * 60 * 1000; // 30 Menit (Master data jarang berubah)

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
        // Load initial variant cache from storage if exists
        if (typeof window !== 'undefined') {
            const cachedVars = localStorage.getItem(CACHE_KEY_VARIANTS);
            if (cachedVars) {
                try { setVariantsCache(JSON.parse(cachedVars)); } catch(e) {}
            }
        }
        fetchData(); 
    }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache LocalStorage
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

            // 2. Fetch Data (Parallel)
            const [snapBrands, snapCats, snapProds] = await Promise.all([
                getDocs(query(collection(db, "brands"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "products"), limit(100))) // Batasi 100 untuk hemat reads awal
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

            // 3. Simpan Cache
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY_MAIN, JSON.stringify({
                    brands: bs,
                    categories: cs,
                    products: sortedProducts,
                    timestamp: Date.now()
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
        
        // Cek cache state (yang sudah di-load dari localStorage)
        if(!variantsCache[id]) {
            setLoadingVariants(true);
            try {
                const q = query(collection(db, "product_variants"), where("product_id", "==", id));
                const s = await getDocs(q); 
                const v=[]; 
                s.forEach(d=>v.push({id:d.id, ...d.data()}));
                
                // Update state dan localStorage
                const newCache = {...variantsCache, [id]:v};
                setVariantsCache(newCache);
                
                if (typeof window !== 'undefined') {
                    localStorage.setItem(CACHE_KEY_VARIANTS, JSON.stringify(newCache));
                }
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
                
                // Invalidate Main Cache
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY_MAIN);
                
                setModalOpen(false); 
                fetchData(true); 
                resolve();
            } catch(e) {
                reject(e);
            }
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
        <div className="space-y-6 fade-in pb-20">
            {/* Header Solid & Sticky */}
            <div className="flex flex-col md:flex-row justify-between items-center sticky top-0 z-20 bg-lumina-surface py-4 px-4 md:px-8 border-b border-lumina-border/50 shadow-md md:static">
            <div className="flex flex-col w-full md:w-auto">
                <h2 className="text-xl md:text-3xl font-bold text-lumina-text flex-shrink-0">
                Product Models
                </h2>
                <p className="hidden md:block text-sm text-lumina-muted mt-2 font-light">
                Kelola SKU, Variant dan Detail Master Produk
                </p>
            </div>
            <div className="flex w-full md:w-80 flex-row items-center gap-2 mt-2 md:mt-0">
                <div className="relative w-full">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-lumina-muted">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </span>
                <input
                    type="text"
                    placeholder="Search SKU Produk..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 bg-transparent text-lumina-text text-sm py-2 outline-none placeholder:text-lumina-muted/50 font-mono rounded-full border border-lumina-border"
                />
                </div>
                <button
                onClick={() => openModal()}
                className="btn-gold h-10 px-4 rounded-full text-xs font-semibold flex items-center justify-center"
                >
                Add
                </button>
            </div>
            </div>

            {/* --- VIEW DESKTOP (TABLE) --- */}
            <div className="hidden md:block card-luxury overflow-hidden">
                <table className="table-dark w-full">
                    <thead><tr><th className="w-16 pl-6">Img</th><th>Product Name</th><th>Base SKU</th><th>Brand</th><th className="text-center">Status</th><th className="text-right pr-8">Actions</th><th className="w-10"></th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan="7" className="p-12 text-center text-lumina-muted animate-pulse">Loading...</td></tr> : filtered.map(p => {
                            const isExpanded = expandedProductId === p.id;
                            return (
                                <React.Fragment key={p.id}>
                                    {/* PARENT ROW */}
                                    <tr 
                                        onClick={() => toggleVariants(p.id)} 
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
                                            <div className="text-xs text-lumina-muted mt-1">{p.category}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm text-lumina-muted group-hover:text-lumina-text transition-colors">{p.base_sku}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="badge-luxury badge-neutral">{p.brand_name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`badge-luxury ${p.status==='active'?'badge-success':'badge-danger'}`}>{p.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right pr-8" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openModal(p)} className="text-[10px] uppercase font-bold text-lumina-muted hover:text-lumina-text border border-lumina-border hover:border-white rounded px-2 py-1 transition-colors">EDIT</button>
                                                <button onClick={() => deleteProduct(p.id)} className="text-[10px] uppercase font-bold text-rose-500 hover:text-rose-400 border border-rose-500/30 hover:border-rose-400 rounded px-2 py-1 transition-colors">DEL</button>
                                            </div>
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
                                            <td colSpan="7" className="p-0">
                                                <div className="p-6 fade-in">
                                                    <div className="border border-lumina-border rounded-lg overflow-hidden w-full bg-lumina-surface">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-lumina-surface text-[10px] text-lumina-muted uppercase tracking-wider font-semibold border-b border-lumina-border">
                                                                <tr>
                                                                    <th className="px-4 py-3">Variant SKU</th>
                                                                    <th className="px-4 py-3">Color</th>
                                                                    <th className="px-4 py-3">Size</th>
                                                                    <th className="px-4 py-3 text-right">Price</th>
                                                                    <th className="px-4 py-3 text-right">Cost</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-lumina-border">
                                                                {loadingVariants ? (
                                                                    <tr><td colSpan="5" className="p-4 text-center text-xs text-lumina-muted animate-pulse">Loading variants...</td></tr>
                                                                ) : (variantsCache[p.id]||[]).sort(sortBySize).map(v => (
                                                                    <tr key={v.id} className="hover:bg-lumina-highlight/20 transition-colors">
                                                                        <td className="px-4 py-3 font-mono text-lumina-gold text-xs font-bold">{v.sku}</td>
                                                                        <td className="px-4 py-3 text-lumina-text">{v.color}</td>
                                                                        <td className="px-4 py-3 text-lumina-text">{v.size}</td>
                                                                        <td className="px-4 py-3 text-right font-mono font-medium text-lumina-text">{formatRupiah(v.price)}</td>
                                                                        <td className="px-4 py-3 text-right font-mono text-lumina-muted">{formatRupiah(v.cost)}</td>
                                                                    </tr>
                                                                ))}
                                                                {(!loadingVariants && (!variantsCache[p.id] || variantsCache[p.id].length === 0)) && (
                                                                     <tr><td colSpan="5" className="p-4 text-center text-xs text-lumina-muted">No variants found.</td></tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* --- VIEW MOBILE (CARDS) --- */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {loading ? <div className="text-center py-10">Loading...</div> : filtered.map(p => (
                    <div key={p.id} onClick={()=>toggleVariants(p.id)} className="card-luxury p-4 active:scale-[0.98] transition-transform">
                         <div className="flex gap-4 items-center">
                            <div className="w-16 h-16 rounded-lg bg-lumina-surface border border-lumina-border flex-shrink-0 overflow-hidden">
                                {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-lumina-muted">IMG</div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-mono font-bold text-lumina-gold bg-lumina-surface px-1.5 py-0.5 rounded border border-lumina-border">{p.base_sku}</span>
                                    <span className={`text-[10px] px-1.5 rounded border ${p.status==='active'?'border-emerald-500/30 text-emerald-400':'border-rose-500/30 text-rose-400'}`}>{p.status}</span>
                                </div>
                                <h3 className="text-sm font-bold text-lumina-text mt-1 truncate">{p.name}</h3>
                                <p className="text-xs text-lumina-muted mt-0.5">{p.brand_name} • {p.category}</p>
                            </div>
                         </div>
                         
                         {/* Mobile Actions */}
                         <div className="mt-3 pt-3 border-t border-lumina-border flex justify-between items-center">
                             <button className="text-xs text-lumina-muted flex items-center gap-1">
                                 Lihat Varian {expandedProductId===p.id ? '▲' : '▼'}
                             </button>
                             <div className="flex gap-3">
                                <button onClick={(e)=>{e.stopPropagation(); openModal(p)}} className="text-xs font-bold text-lumina-gold">EDIT</button>
                                <button onClick={(e)=>{e.stopPropagation(); deleteProduct(p.id)}} className="text-xs font-bold text-rose-500">DEL</button>
                             </div>
                         </div>

                         {/* Mobile Variants Expand */}
                         {expandedProductId===p.id && (
                             <div className="mt-3 bg-lumina-surface rounded-lg border border-lumina-border p-2 animate-fade-in">
                                 <div className="text-[10px] text-lumina-muted mb-2 uppercase tracking-wider font-bold">Varian Tersedia</div>
                                 <div className="space-y-2">
                                     {(variantsCache[p.id]||[]).sort(sortBySize).map(v=>(
                                         <div key={v.id} className="flex justify-between items-center text-xs border-b border-lumina-border/50 pb-1 last:border-0 last:pb-0">
                                             <div>
                                                 <div className="font-mono text-lumina-gold">{v.sku}</div>
                                                 <div className="text-lumina-muted">{v.color} / {v.size}</div>
                                             </div>
                                             <div className="font-bold">{formatRupiah(v.price)}</div>
                                         </div>
                                     ))}
                                     {loadingVariants && <div className="text-center text-xs py-2 text-lumina-muted">Memuat varian...</div>}
                                 </div>
                             </div>
                         )}
                    </div>
                ))}
            </div>

            {/* Modal (Same for Mobile & Desktop) */}
            <Portal>
            {modalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-lumina-surface/80 backdrop-blur-sm p-4">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-lumina-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-lumina-text">{formData.id ? "Edit" : "Baru"}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-2xl text-lumina-muted">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            {/* Existing Form Content */}
                            <div className="flex items-center gap-4 p-4 bg-lumina-surface rounded-lg border border-dashed border-lumina-border">
                                <div className="w-20 h-20 rounded-lg bg-lumina-surface flex items-center justify-center overflow-hidden border border-lumina-border relative">
                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <span className="text-xs">IMG</span>}
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0" disabled={uploading}/>
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs mb-2">Ganti Gambar (Max 2MB)</div>
                                    <label className="btn-ghost-dark text-xs py-1 px-3 inline-block cursor-pointer">
                                        Pilih File
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={uploading}/>
                                    </label>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold block mb-1">Brand</label><select className="input-luxury" value={formData.brandId} onChange={e=>setFormData({...formData, brandId:e.target.value})}>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                <div><label className="text-xs font-bold block mb-1">SKU Base</label><input className="input-luxury" value={formData.baseSku} onChange={e=>setFormData({...formData, baseSku:e.target.value})} /></div>
                            </div>
                            <div><label className="text-xs font-bold block mb-1">Nama Produk</label><input className="input-luxury" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold block mb-1">Kategori</label><select className="input-luxury" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                                <div><label className="text-xs font-bold block mb-1">Status</label><select className="input-luxury" value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-lumina-border flex justify-end gap-3">
                            <button onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Batal</button>
                            <button onClick={handleSubmit} className="btn-gold">{uploading ? '...' : 'Simpan'}</button>
                        </div>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}