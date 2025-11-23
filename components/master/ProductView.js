// app/products/page.js
"use client";
import { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sortBySize, formatRupiah } from '@/lib/utils';
import imageCompression from 'browser-image-compression';

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal State (Hanya untuk Add/Edit Produk)
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    
    // Image Upload State
    const [imageFile, setImageFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    // --- ACCORDION STATE (New) ---
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [variantsCache, setVariantsCache] = useState({}); // Cache data varian agar tidak fetch ulang terus
    const [loadingVariants, setLoadingVariants] = useState(false);
    
    // Filter State
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [snapBrands, snapCats, snapProds] = await Promise.all([
                getDocs(query(collection(db, "brands"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
                getDocs(collection(db, "products"))
            ]);

            const brandsData = []; snapBrands.forEach(d => brandsData.push({id: d.id, ...d.data()}));
            setBrands(brandsData);

            const catsData = []; snapCats.forEach(d => catsData.push({id: d.id, ...d.data()}));
            setCategories(catsData);

            const prodsData = [];
            snapProds.forEach(d => {
                const data = d.data();
                const brandName = brandsData.find(b => b.id === data.brand_id)?.name || '';
                prodsData.push({id: d.id, ...data, brand_name: brandName});
            });
            prodsData.sort((a,b) => (a.base_sku || '').localeCompare(b.base_sku || ''));
            setProducts(prodsData);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.base_sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- ACCORDION LOGIC ---
    const toggleVariants = async (productId) => {
        // Jika diklik lagi, tutup accordion
        if (expandedProductId === productId) {
            setExpandedProductId(null);
            return;
        }

        setExpandedProductId(productId);

        // Cek apakah data varian sudah ada di cache?
        if (!variantsCache[productId]) {
            setLoadingVariants(true);
            try {
                const q = query(collection(db, "product_variants"), where("product_id", "==", productId));
                const snap = await getDocs(q);
                const vars = [];
                snap.forEach(d => vars.push({id: d.id, ...d.data()}));
                
                // Simpan ke cache
                setVariantsCache(prev => ({ ...prev, [productId]: vars }));
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingVariants(false);
            }
        }
    };

    const openModal = (prod = null) => {
        setImageFile(null);
        setUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
        
        if (prod) {
            setFormData({ ...prod });
            setPreviewUrl(prod.image_url || null);
        } else {
            setFormData({ brand_id: '', name: '', base_sku: '', category: '', description: '', status: 'active', image_url: '' });
            setPreviewUrl(null);
        }
        setModalOpen(true);
    };

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) return alert('Harap upload file gambar.');
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        console.log("1. Memulai proses submit...");

        try {
            let imageUrl = formData.image_url;

            if (imageFile) {
                console.log("2. File gambar terdeteksi. Memulai kompresi...");
                const options = { maxSizeMB: 0.1, maxWidthOrHeight: 800, useWebWorker: true, fileType: 'image/webp' };

                let compressedBlob;
                try {
                    compressedBlob = await imageCompression(imageFile, options);
                    console.log("3. Kompresi Berhasil:", compressedBlob.size);
                } catch (compError) {
                    console.error("Gagal kompresi, menggunakan file asli:", compError);
                    compressedBlob = imageFile;
                }
                
                console.log("4. Memulai Upload ke Firebase Storage...");
                const fileName = `products/${Date.now()}_${imageFile.name.replace(/\.[^/.]+$/, "")}.webp`;
                const storageRef = ref(storage, fileName);
                
                const snapshot = await uploadBytes(storageRef, compressedBlob);
                imageUrl = await getDownloadURL(snapshot.ref);
                
                if(previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
            }

            console.log("7. Menyimpan data produk ke Firestore...");
            const payload = { 
                ...formData, 
                image_url: imageUrl || '',
                updated_at: serverTimestamp() 
            };

            if (formData.id) {
                await updateDoc(doc(db, "products", formData.id), payload);
            } else {
                payload.created_at = serverTimestamp();
                await addDoc(collection(db, "products"), payload);
            }
            
            alert("Produk berhasil disimpan!");
            setModalOpen(false); 
            fetchData();
        } catch (err) { 
            console.error("ERROR:", err);
            alert(`Gagal: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const deleteProduct = async (id) => {
        if(confirm("Hapus produk ini?")) { await deleteDoc(doc(db, "products", id)); fetchData(); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Products</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage your product catalog and base models.</p>
                </div>
                <button onClick={() => openModal()} className="btn-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                    Add Product
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1">
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input 
                        type="text" 
                        placeholder="Search by name or SKU..." 
                        className="w-full pl-10 pr-4 py-2 text-sm text-gray-700 bg-transparent border-none focus:ring-0 placeholder-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="card p-0 overflow-hidden">
                <div className="table-wrapper border-0 rounded-none shadow-none">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th className="w-16 pl-6">Image</th>
                                <th>Product Info</th>
                                <th>Brand</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-12 text-gray-400">Loading data...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-12 text-gray-400">No products found.</td></tr>
                            ) : (
                                filteredProducts.map(p => {
                                    const isExpanded = expandedProductId === p.id;
                                    
                                    return (
                                        <>
                                            <tr key={p.id} className={`group transition-colors ${isExpanded ? 'bg-brand-50/30' : 'hover:bg-gray-50'}`}>
                                                <td className="pl-6 py-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                                                        {p.image_url ? (
                                                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{p.name}</span>
                                                        {/* ACCORDION TRIGGER */}
                                                        <button 
                                                            onClick={() => toggleVariants(p.id)} 
                                                            className="text-xs font-mono text-brand-600 hover:text-brand-800 hover:underline text-left w-fit flex items-center gap-1 mt-0.5 transition-colors"
                                                        >
                                                            <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span> 
                                                            {p.base_sku}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td><span className="badge badge-neutral">{p.brand_name || '-'}</span></td>
                                                <td><span className="text-sm text-gray-600">{p.category}</span></td>
                                                <td>
                                                    <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                                                        {p.status || 'Active'}
                                                    </span>
                                                </td>
                                                <td className="text-right pr-6">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openModal(p)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-lg transition-colors">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                                        </button>
                                                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ACCORDION CONTENT ROW */}
                                            {isExpanded && (
                                                <tr className="bg-gray-50/50 shadow-inner">
                                                    <td colSpan="6" className="p-0">
                                                        <div className="p-4 pl-[5.5rem] fade-in">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Variants List</span>
                                                                <div className="h-px flex-1 bg-gray-200"></div>
                                                            </div>
                                                            
                                                            {loadingVariants && !variantsCache[p.id] ? (
                                                                <div className="py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                    Loading variants...
                                                                </div>
                                                            ) : (variantsCache[p.id] || []).length === 0 ? (
                                                                <div className="py-4 text-center text-xs text-gray-400 italic">No variants available.</div>
                                                            ) : (
                                                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-3xl">
                                                                    <table className="w-full text-sm text-left">
                                                                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
                                                                            <tr>
                                                                                <th className="px-4 py-2 font-medium">SKU</th>
                                                                                <th className="px-4 py-2 font-medium">Color</th>
                                                                                <th className="px-4 py-2 font-medium">Size</th>
                                                                                <th className="px-4 py-2 font-medium text-right">HPP</th>
                                                                                <th className="px-4 py-2 font-medium text-right">Price</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-50">
                                                                            {(variantsCache[p.id] || []).sort(sortBySize).map(v => (
                                                                                <tr key={v.id} className="hover:bg-brand-50/20 transition-colors">
                                                                                    <td className="px-4 py-2 font-mono text-xs text-brand-700 font-bold">{v.sku}</td>
                                                                                    <td className="px-4 py-2"><span className="badge badge-neutral">{v.color}</span></td>
                                                                                    <td className="px-4 py-2"><span className="badge badge-neutral">{v.size}</span></td>
                                                                                    <td className="px-4 py-2 text-right text-xs text-gray-500">{formatRupiah(v.cost)}</td>
                                                                                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatRupiah(v.price)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Product Form - Tetap sama seperti sebelumnya */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 transition-all">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-lg w-full p-6 fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">{formData.id ? 'Edit Product' : 'New Product'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600" disabled={uploading}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Image Upload Area */}
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-20 h-20 rounded-lg bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group shrink-0">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Product Image</label>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 transition-all" disabled={uploading} />
                                    <p className="text-[10px] text-gray-400 mt-1">Recommends: Square (1:1), max 200KB (WebP).</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
                                    <select required className="select-field" value={formData.brand_id} onChange={e=>setFormData({...formData, brand_id:e.target.value})} disabled={uploading}>
                                        <option value="">Select Brand</option>
                                        {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Base SKU</label>
                                    <input required className="input-field font-mono uppercase" value={formData.base_sku} onChange={e=>setFormData({...formData, base_sku:e.target.value})} placeholder="PRD-001" disabled={uploading} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Product Name</label>
                                <input required className="input-field" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="Enter product name" disabled={uploading} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                    <select required className="select-field" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} disabled={uploading}>
                                        <option value="">Select Category</option>
                                        {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                    <input className="input-field" value={formData.description || ''} onChange={e=>setFormData({...formData, description:e.target.value})} placeholder="Short desc" disabled={uploading} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost" disabled={uploading}>Cancel</button>
                                <button type="submit" className="btn-primary relative" disabled={uploading}>
                                    {uploading ? 'Processing...' : 'Save Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}