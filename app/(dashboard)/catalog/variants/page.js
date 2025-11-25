"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, limit } from 'firebase/firestore';
import { sortBySize, formatRupiah } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE ---
const CACHE_KEY_VARIANTS = 'lumina_variants_v2';
const CACHE_KEY_PRODUCTS = 'lumina_products_data_v2'; // Share cache dengan Products Page
const CACHE_DURATION = 30 * 60 * 1000; // 30 Menit

export default function VariantsPage() {
    const [variants, setVariants] = useState([]);
    const [products, setProducts] = useState([]); // Parent lookup
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBaseSku, setSelectedBaseSku] = useState('-');

    useEffect(() => { 
        fetchData(); 
    }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            let cachedProducts = null;
            let cachedVariants = null;

            // 1. Cek Cache LocalStorage (Prioritaskan cache Produk dari halaman sebelah)
            if (!forceRefresh && typeof window !== 'undefined') {
                const rawProd = localStorage.getItem(CACHE_KEY_PRODUCTS);
                const rawVar = localStorage.getItem(CACHE_KEY_VARIANTS);

                if (rawProd) {
                    const parsed = JSON.parse(rawProd);
                    // Cek apakah struktur cache dari Products Page (ada key 'products') atau cache lokal (array langsung)
                    const prodData = Array.isArray(parsed) ? parsed : (parsed.products || []);
                    if (Date.now() - (parsed.timestamp || 0) < CACHE_DURATION) {
                        cachedProducts = prodData;
                    }
                }

                if (rawVar) {
                    const parsed = JSON.parse(rawVar);
                    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
                        cachedVariants = parsed.data;
                    }
                }
            }

            // 2. Strategi Fetching Hemat Biaya
            const promises = [];

            // A. Fetch Products (Hanya jika cache kosong)
            if (cachedProducts) {
                setProducts(cachedProducts);
            } else {
                // Fetch hanya field yg dibutuhkan untuk dropdown (Hemat Bandwidth)
                // Note: Firestore client SDK tidak support .select() untuk mengurangi biaya Read, 
                // tapi kita bisa mengurangi ukuran download object.
                promises.push(getDocs(query(collection(db, "products"), orderBy("name"))));
            }

            // B. Fetch Variants (Hanya jika cache kosong/expired)
            if (cachedVariants) {
                setVariants(cachedVariants);
            } else {
                promises.push(getDocs(query(collection(db, "product_variants"), orderBy("sku"), limit(100))));
            }

            // Eksekusi Request Firebase (jika ada yang perlu diambil)
            if (promises.length > 0) {
                const results = await Promise.all(promises);
                let prodIdx = 0;

                // Process Products Result (Jika di-fetch)
                if (!cachedProducts) {
                    const snapProd = results[prodIdx++];
                    const ps = [];
                    snapProd.forEach(d => ps.push({id:d.id, name: d.data().name, base_sku: d.data().base_sku})); // Ambil seperlunya
                    setProducts(ps);
                    
                    // Simpan Cache Produk (Format Lite)
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify({
                            products: ps,
                            timestamp: Date.now()
                        }));
                    }
                }

                // Process Variants Result (Jika di-fetch)
                if (!cachedVariants) {
                    const snapVar = results[prodIdx]; // index terakhir
                    const vs = [];
                    snapVar.forEach(d => vs.push({id:d.id, ...d.data()}));
                    setVariants(vs);

                    // Simpan Cache Variants
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(CACHE_KEY_VARIANTS, JSON.stringify({
                            data: vs,
                            timestamp: Date.now()
                        }));
                    }
                }
            }

        } catch(e) {
            console.error("Error fetching variants:", e);
            toast.error("Gagal memuat data");
        } finally {
            setLoading(false);
        }
    };
    
    const handleParentChange = (e) => { 
        const p = products.find(x=>x.id===e.target.value); 
        setFormData({...formData, product_id: e.target.value}); 
        setSelectedBaseSku(p?p.base_sku:'-'); 
    };

    const generateSku = () => {
        const c = formData.color?.toUpperCase().replace(/\s/g,'-'); 
        const s = formData.size?.toUpperCase().replace(/\s/g,'-');
        if(selectedBaseSku!=='-' && c && s) setFormData({...formData, sku: `${selectedBaseSku}-${c}-${s}`});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const toastId = toast.loading("Menyimpan SKU...");
        try {
            const pl = {
                ...formData, 
                updated_at: serverTimestamp(), 
                weight: Number(formData.weight)||0, 
                cost: Number(formData.cost), 
                price: Number(formData.price)
            };
            
            if(formData.id) {
                await updateDoc(doc(db,"product_variants",formData.id), pl); 
            } else { 
                pl.created_at=serverTimestamp(); 
                await addDoc(collection(db,"product_variants"), pl); 
            }
            
            // Invalidate Caches
            if (typeof window !== 'undefined') {
                localStorage.removeItem(CACHE_KEY_VARIANTS);
                // Hapus cache inventory juga karena data varian berubah
                localStorage.removeItem('lumina_inventory_v2'); 
                // Cache Produk varian (detail produk) juga perlu di-refresh
                localStorage.removeItem('lumina_products_variants_v2');
            }

            setModalOpen(false); 
            toast.success("Berhasil disimpan!", { id: toastId });
            fetchData(true);
        } catch(e){ 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    const filteredVariants = variants.filter(v => 
        v.sku.toUpperCase().includes(searchTerm.toUpperCase()) ||
        (products.find(p=>p.id===v.product_id)?.name || '').toUpperCase().includes(searchTerm.toUpperCase())
    );

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20">
            {/* Header Sticky */}
            <div className="flex flex-col md:flex-row justify-between items-center sticky top-0 z-20 bg-lumina-base py-4 px-4 md:px-8 -mx-4 md:-mx-8 border-b border-lumina-border/50 shadow-md md:static">
                <div className="w-full md:w-auto">
                    <h2 className="text-xl md:text-3xl font-bold text-lumina-text">Master SKU</h2>
                    <p className="text-sm text-lumina-muted mt-1 hidden md:block">Kelola varian warna, ukuran, dan harga.</p>
                </div>
                <div className="flex w-full md:w-auto gap-2 mt-2 md:mt-0">
                    <div className="bg-lumina-surface border border-lumina-border p-1.5 rounded-xl shadow-lg flex-1 md:w-64">
                        <input 
                            className="w-full bg-transparent text-lumina-text px-3 py-1 outline-none text-sm" 
                            placeholder="Search SKU / Product..." 
                            value={searchTerm} 
                            onChange={e=>setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <button onClick={() => { setFormData({ product_id:'', sku:'', color:'', size:'', cost:0, price:0, status:'active' }); setSelectedBaseSku('-'); setModalOpen(true); }} className="btn-gold whitespace-nowrap px-6">
                        Add SKU
                    </button>
                </div>
            </div>

            <div className="card-luxury overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-dark w-full">
                        <thead><tr><th className="pl-6">SKU</th><th>Parent</th><th>Spec</th><th className="text-right">Price</th><th className="text-right pr-6">Action</th></tr></thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-8 text-lumina-muted animate-pulse">Loading variants...</td></tr>
                            ) : filteredVariants.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-8 text-lumina-muted">No variants found (loaded top 100).</td></tr>
                            ) : (
                                filteredVariants.map(v=>(
                                    <tr key={v.id} className="hover:bg-lumina-highlight/20 transition-colors">
                                        <td className="pl-6 py-3 font-mono text-lumina-gold font-bold text-sm">{v.sku}</td>
                                        <td className="text-lumina-text text-sm">{products.find(p=>p.id===v.product_id)?.name || '-'}</td>
                                        <td>
                                            <div className="flex gap-1">
                                                <span className="badge-luxury badge-neutral">{v.color}</span>
                                                <span className="badge-luxury badge-neutral">{v.size}</span>
                                            </div>
                                        </td>
                                        <td className="text-right font-bold text-lumina-text text-sm font-mono">{formatRupiah(v.price)}</td>
                                        <td className="text-right pr-6">
                                            <button onClick={()=>{setFormData({...v}); 
                                                const p = products.find(x=>x.id===v.product_id);
                                                setSelectedBaseSku(p?p.base_sku:'-');
                                                setModalOpen(true);}} className="text-xs font-bold text-lumina-muted hover:text-lumina-text border border-lumina-border hover:border-white px-2 py-1 rounded transition-colors">
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

            {/* --- CENTERED MODAL --- */}
            <Portal>
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-lumina-border flex justify-between items-center bg-lumina-surface rounded-t-2xl">
                            <h3 className="text-lg font-bold text-lumina-text">{formData.id?'Edit SKU':'New SKU'}</h3>
                            <button onClick={()=>setModalOpen(false)} className="text-lumina-muted hover:text-lumina-text text-xl">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            <div className="bg-lumina-base p-4 rounded-xl border border-lumina-border">
                                <label className="text-xs font-bold text-lumina-muted uppercase block">Parent Product</label>
                                <select className="input-luxury mt-1 w-full" value={formData.product_id} onChange={handleParentChange}>
                                    <option value="">-- Select Product --</option>
                                    {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <div className="text-xs text-lumina-gold mt-2 font-mono">Base SKU: {selectedBaseSku}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="text-xs font-bold text-lumina-muted block mb-1">Color</label><input className="input-luxury w-full" value={formData.color} onChange={e=>setFormData({...formData, color:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-lumina-muted block mb-1">Size</label><input className="input-luxury w-full" value={formData.size} onChange={e=>setFormData({...formData, size:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-lumina-muted block mb-1">Weight (g)</label><input type="number" className="input-luxury w-full" value={formData.weight} onChange={e=>setFormData({...formData, weight:e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-lumina-muted block mb-1">SKU Final</label>
                                    <div className="flex gap-2">
                                        <input className="input-luxury font-mono w-full" value={formData.sku} onChange={e=>setFormData({...formData, sku:e.target.value})} />
                                        <button onClick={generateSku} type="button" className="btn-ghost-dark px-3 py-2 text-xs">Auto</button>
                                    </div>
                                </div>
                                <div><label className="text-xs font-bold text-lumina-muted block mb-1">Barcode</label><input className="input-luxury w-full" value={formData.barcode} onChange={e=>setFormData({...formData, barcode:e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-lumina-muted block mb-1">HPP (Cost)</label><input type="number" className="input-luxury w-full" value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-lumina-gold block mb-1">Sell Price</label><input type="number" className="input-luxury w-full border-lumina-gold/50 focus:border-lumina-gold" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})}/></div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-lumina-border bg-lumina-surface rounded-b-2xl flex justify-end gap-3">
                            <button onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                            <button onClick={handleSubmit} className="btn-gold">Save SKU</button>
                        </div>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}