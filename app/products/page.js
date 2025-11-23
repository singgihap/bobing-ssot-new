// app/products/page.js
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sortBySize, formatRupiah } from '@/lib/utils';
import imageCompression from 'browser-image-compression';
import { Portal } from '@/lib/usePortal';

export default function ProductsPage() {
    // ... (Kode ini SAMA PERSIS dengan kode ProductsPage terakhir yang saya berikan di respons sebelumnya yang sudah ada accordion dan modal centered) ...
    // Agar tidak memotong, saya paste ulang kode lengkapnya di sini untuk memastikan:

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

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [snapBrands, snapCats, snapProds] = await Promise.all([
                getDocs(query(collection(db, "brands"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
                getDocs(collection(db, "products"))
            ]);
            const bs = []; snapBrands.forEach(d => bs.push({id:d.id, ...d.data()})); setBrands(bs);
            const cs = []; snapCats.forEach(d => cs.push({id:d.id, ...d.data()})); setCategories(cs);
            const ps = []; snapProds.forEach(d => { const p=d.data(); const b=bs.find(x=>x.id===p.brand_id); ps.push({id:d.id, ...p, brand_name:b?b.name:''}); });
            setProducts(ps.sort((a,b)=>(a.base_sku||'').localeCompare(b.base_sku||'')));
        } catch(e){console.error(e)} finally{setLoading(false)}
    };

    const toggleVariants = async (id) => {
        if(expandedProductId===id) { setExpandedProductId(null); return; }
        setExpandedProductId(id);
        if(!variantsCache[id]) {
            setLoadingVariants(true);
            const q = query(collection(db, "product_variants"), where("product_id", "==", id));
            const s = await getDocs(q); const v=[]; s.forEach(d=>v.push({id:d.id, ...d.data()}));
            setVariantsCache(prev=>({...prev, [id]:v}));
            setLoadingVariants(false);
        }
    };

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) return alert('Harap upload file gambar.');
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
        e.preventDefault(); setUploading(true);
        try {
            let url = formData.image_url;
            if(imageFile) {
                const blob = await imageCompression(imageFile, {maxSizeMB:0.1, maxWidthOrHeight:800, fileType:'image/webp'}).catch(()=>imageFile);
                const sRef = ref(storage, `products/${Date.now()}.webp`);
                await uploadBytes(sRef, blob); url = await getDownloadURL(sRef);
            }
            const pl = {...formData, image_url: url||'', updated_at: serverTimestamp()};
            if(formData.id) await updateDoc(doc(db,"products",formData.id), pl); else { pl.created_at=serverTimestamp(); await addDoc(collection(db,"products"), pl); }
            setModalOpen(false); fetchData(); alert("Disimpan!");
        } catch(e){alert(e.message)} finally{setUploading(false)}
    };

    const deleteProduct = async (id) => { if(confirm("Hapus?")) { await deleteDoc(doc(db,"products",id)); fetchData(); } };
    
    const filtered = products.filter(p=>p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.base_sku.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6 fade-in pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-lumina-text">Product Models</h2>
                <button onClick={()=>openModal()} className="btn-gold">Add Product</button>
            </div>
            <div className="bg-lumina-surface border border-lumina-border p-2 rounded-xl shadow-lg w-full max-w-md">
                <input className="w-full bg-transparent text-lumina-text px-3 py-1 outline-none" placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
            </div>

            <div className="card-luxury overflow-hidden">
                <table className="table-dark w-full">
                    <thead><tr><th className="w-16 pl-6">Img</th><th>Info</th><th>Brand</th><th>Status</th><th className="text-right pr-6">Act</th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan="5" className="p-8 text-center">Loading...</td></tr> : filtered.map(p => (
                            <React.Fragment key={p.id}>
                                <tr onClick={()=>toggleVariants(p.id)} className="hover:bg-lumina-highlight/20 cursor-pointer transition">
                                    <td className="pl-6 py-3"><div className="w-10 h-10 rounded bg-lumina-base border border-lumina-border overflow-hidden">{p.image_url && <img src={p.image_url} className="w-full h-full object-cover"/>}</div></td>
                                    <td><div className="font-bold text-lumina-gold text-lg font-mono flex gap-2">{p.base_sku} <span className="text-xs text-lumina-muted">▼</span></div><div className="text-sm text-lumina-text">{p.name}</div></td>
                                    <td><span className="badge-luxury badge-neutral">{p.brand_name}</span></td>
                                    <td><span className={`badge-luxury ${p.status==='active'?'badge-success':'badge-danger'}`}>{p.status}</span></td>
                                    <td className="text-right pr-6"><button onClick={(e)=>{e.stopPropagation(); openModal(p)}} className="text-xs font-bold text-lumina-muted hover:text-white mr-3">Edit</button><button onClick={(e)=>{e.stopPropagation(); deleteProduct(p.id)}} className="text-xs font-bold text-rose-500 hover:text-rose-400">Del</button></td>
                                </tr>
                                {expandedProductId===p.id && (
                                    <tr className="bg-[#0B0C10] border-b border-lumina-border"><td colSpan="5" className="p-4 pl-20"><div className="border border-lumina-border rounded-lg overflow-hidden"><table className="w-full text-sm text-left bg-lumina-surface"><thead className="text-xs text-lumina-muted uppercase bg-lumina-base border-b border-lumina-border"><tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Spec</th><th className="px-4 py-2 text-right">Price</th></tr></thead><tbody className="divide-y divide-lumina-border">{(variantsCache[p.id]||[]).sort(sortBySize).map(v=>(<tr key={v.id}><td className="px-4 py-2 font-mono text-lumina-gold">{v.sku}</td><td className="px-4 py-2 text-lumina-text">{v.color} / {v.size}</td><td className="px-4 py-2 text-right font-bold">{formatRupiah(v.price)}</td></tr>))}</tbody></table></div></td></tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <Portal>
            {modalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999]"
                    onClick={() => setModalOpen(false)}
                />

                {/* Modal */}
                <div className="relative z-[10000] bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
                    
                    {/* HEADER */}
                    <div className="px-6 py-4 border-b border-lumina-border flex justify-between items-center bg-lumina-surface rounded-t-2xl flex-shrink-0">
                    <h3 className="text-xl font-bold text-white">
                        {formData.id ? "Edit Product" : "New Product"}
                    </h3>
                    <button
                        onClick={() => setModalOpen(false)}
                        className="text-lumina-muted hover:text-white transition-colors p-1"
                        aria-label="Close modal"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    </div>

                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 space-y-5 bg-lumina-base custom-scrollbar">
                    
                    {/* Image Upload */}
                    <div className="flex items-center gap-4 p-4 bg-lumina-surface rounded-lg border border-dashed border-lumina-border hover:border-lumina-gold/50 transition-colors">
                        <div className="w-24 h-24 rounded-lg bg-lumina-base flex items-center justify-center overflow-hidden border border-lumina-border flex-shrink-0 relative">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs text-lumina-muted font-mono">IMG</span>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={uploading}
                        />
                        </div>
                        <div className="flex-1">
                        <div className="text-sm font-semibold text-lumina-text mb-1">Product Image</div>
                        <div className="text-xs text-lumina-muted mb-3">Max 2MB, Auto WebP Compress.</div>
                        <label className="inline-block">
                            <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            disabled={uploading}
                            />
                            <span className="inline-block px-4 py-2 bg-lumina-highlight text-white text-xs font-semibold rounded-full cursor-pointer hover:bg-lumina-gold transition-colors">
                            Choose File
                            </span>
                        </label>
                        </div>
                    </div>

                    {/* Brand & SKU */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Brand</label>
                        <select
                            className="w-full px-3 py-2 bg-lumina-base border border-lumina-border rounded-lg text-white focus:border-lumina-gold outline-none"
                            value={formData.brandId || ""}
                            onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                            disabled={uploading}
                        >
                            <option value="">-- Select --</option>
                            {brands.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        </div>
                        <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Base SKU</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 bg-lumina-base border border-lumina-border rounded-lg text-white font-mono uppercase focus:border-lumina-gold outline-none"
                            value={formData.baseSku || "PRD-001"}
                            onChange={(e) => setFormData({ ...formData, baseSku: e.target.value })}
                            placeholder="PRD-001"
                            disabled={uploading}
                        />
                        </div>
                    </div>

                    {/* Product Name */}
                    <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Product Name</label>
                        <input
                        type="text"
                        required
                        className="w-full px-3 py-2 bg-lumina-base border border-lumina-border rounded-lg text-white focus:border-lumina-gold outline-none"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter product name..."
                        disabled={uploading}
                        />
                    </div>

                    {/* Category & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Category</label>
                        <select
                            required
                            className="w-full px-3 py-2 bg-lumina-base border border-lumina-border rounded-lg text-white focus:border-lumina-gold outline-none"
                            value={formData.category || ""}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            disabled={uploading}
                        >
                            <option value="">-- Select --</option>
                            {categories.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                        </div>
                        <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Status</label>
                        <select
                            className="w-full px-3 py-2 bg-lumina-base border border-lumina-border rounded-lg text-white focus:border-lumina-gold outline-none"
                            value={formData.status || "active"}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            disabled={uploading}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Description</label>
                        <textarea
                        rows={5}
                        className="w-full px-3 py-2 bg-lumina-base border border-lumina-border rounded-lg text-white focus:border-lumina-gold outline-none resize-none"
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Product details..."
                        disabled={uploading}
                        />
                    </div>

                    </div>

                    {/* FOOTER */}
                    <div className="px-6 py-4 border-t border-lumina-border bg-lumina-surface rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="px-6 py-2 bg-lumina-base text-white rounded-lg hover:bg-lumina-highlight transition-colors font-medium"
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-8 py-2 bg-lumina-gold text-black rounded-lg hover:bg-yellow-400 transition-colors font-semibold flex items-center gap-2"
                        disabled={uploading}
                    >
                        {uploading ? (
                        <>
                            <span className="inline-block w-4 h-4 border-2 border-transparent border-t-black rounded-full animate-spin"></span>
                            Saving...
                        </>
                        ) : (
                        "SAVE"
                        )}
                    </button>
                    </div>

                </div>
                </div>
            )}
            </Portal>
        </div>
    );
}