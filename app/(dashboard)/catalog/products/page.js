"use client";
import React, { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';


// --- IMPORT COMPONENTS (Baru) ---
import ProductTable from './components/ProductTable';
import ProductCardList from './components/ProductCardList';
import ProductFormModal from './components/ProductFormModal';


// --- UI ICONS ---
import { Search, Plus, RotateCcw } from 'lucide-react';


// --- CACHE MANAGER ---
import {
    getCache,
    setCache,
    invalidateSmart,
    CACHE_KEYS,
    DURATION
} from '@/lib/cacheManager';


export default function ProductsPage() {
    // --- DATA STATE ---
    const [products, setProducts] = useState([]);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
   
    // --- UI STATE ---
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [uploading, setUploading] = useState(false);
   
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [variantsCache, setVariantsCache] = useState({});
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');


    // 1. INITIAL LOAD (With Cache)
    useEffect(() => {
        // Load Variants Cache (Optional optimization)
        if (typeof window !== 'undefined') {
            const cachedVars = getCache(CACHE_KEYS.VARIANTS, DURATION.LONG);
            if (cachedVars) setVariantsCache(cachedVars);
        }
        fetchData();
    }, []);


    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // A. Cek Cache Utama
            if (!forceRefresh) {
                const cached = getCache(CACHE_KEYS.PRODUCTS, DURATION.LONG);
                if (cached) {
                    setBrands(cached.brands);
                    setCategories(cached.categories);
                    setCollections(cached.collections || []);
                    setProducts(cached.products);
                    setLoading(false);
                    return;
                }
            }


            // B. Fetch Firebase (Parallel)
            const [snapBrands, snapCats, snapCols, snapProds] = await Promise.all([
                getDocs(query(collection(db, "brands"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "collections"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "products"), limit(200)))
            ]);


            const bs = snapBrands.docs.map(d => ({id:d.id, ...d.data()}));
            const cs = snapCats.docs.map(d => ({id:d.id, ...d.data()}));
            const cls = snapCols.docs.map(d => ({id:d.id, ...d.data()}));
           
            const ps = snapProds.docs.map(d => {
                const p=d.data();
                const b=bs.find(x=>x.id===p.brand_id);
                const c=cs.find(x=>x.id===p.category_id);
                const col=cls.find(x=>x.id===p.collection_id);
                return {
                    id:d.id, ...p,
                    brand_name: b ? b.name : '',
                    category_name: c ? c.name : (p.category || ''),
                    collection_name: col ? col.name : ''
                };
            }).sort((a,b)=>(a.base_sku||'').localeCompare(b.base_sku||''));


            setBrands(bs); setCategories(cs); setCollections(cls); setProducts(ps);


            // C. Simpan Cache
            setCache(CACHE_KEYS.PRODUCTS, {
                brands: bs,
                categories: cs,
                collections: cls,
                products: ps
            });


        } catch(e) {
            console.error(e);
            toast.error("Gagal memuat data");
        } finally {
            setLoading(false);
        }
    };


    // 2. VARIANT EXPANSION (On-Demand Fetching)
    const toggleVariants = async (id) => {
        if(expandedProductId===id) { setExpandedProductId(null); return; }
        setExpandedProductId(id);
       
        if(!variantsCache[id]) {
            setLoadingVariants(true);
            try {
                const q = query(collection(db, "product_variants"), where("product_id", "==", id));
                const s = await getDocs(q);
                const v = s.docs.map(d=>({id:d.id, ...d.data()}));
               
                const newCache = {...variantsCache, [id]:v};
                setVariantsCache(newCache);
                setCache(CACHE_KEYS.VARIANTS, newCache);
            } catch (e) {
                toast.error("Gagal memuat varian");
            } finally {
                setLoadingVariants(false);
            }
        }
    };


    // 3. CREATE / UPDATE ACTION
    const handleSave = async (formData, imageFile) => {
        setUploading(true);
        const tId = toast.loading('Menyimpan...');
       
        try {
            let url = formData.image_url;
           
            // Upload Image jika ada file baru
            if(imageFile) {
                const blob = await imageCompression(imageFile, {maxSizeMB:0.1, maxWidthOrHeight:800, fileType:'image/webp'}).catch(()=>imageFile);
                const sRef = ref(storage, `products/${Date.now()}.webp`);
                await uploadBytes(sRef, blob);
                url = await getDownloadURL(sRef);
            }
           
            const pl = {
                ...formData,
                category: categories.find(c=>c.id===formData.category_id)?.name || '',
                image_url: url||'',
                updated_at: serverTimestamp()
            };
           
            if(formData.id) {
                await updateDoc(doc(db,"products",formData.id), pl);
            } else {
                pl.created_at=serverTimestamp();
                await addDoc(collection(db,"products"), pl);
            }
           
            // INVALIDATE SMART (Membersihkan Cache Produk, Inventory, POS)
            invalidateSmart('PRODUCT');
           
            setModalOpen(false);
            fetchData(true);
            toast.success('Produk disimpan!', { id: tId });


        } catch(e) {
            toast.error(`Gagal: ${e.message}`, { id: tId });
        } finally {
            setUploading(false);
        }
    };


    // 4. DELETE ACTION
    const deleteProduct = async (id) => {
        if(confirm("Hapus?")) {
            const tId = toast.loading("Menghapus...");
            try {
                await deleteDoc(doc(db,"products",id));
               
                // INVALIDATE SMART
                invalidateSmart('PRODUCT');
               
                fetchData(true);
                toast.success("Produk dihapus", { id: tId });
            } catch(e) {
                toast.error("Gagal menghapus", { id: tId });
            }
        }
    };
   
    // Filter Client-Side
    const filtered = products.filter(p=>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.base_sku.toLowerCase().includes(searchTerm.toLowerCase())
    );


    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 text-text-primary bg-background min-h-screen">
            <PageHeader title="Master Produk" subtitle="Kelola katalog produk, tagging koleksi, dan spesifikasi." actions={
                <div className="flex gap-3 items-center">
                    <button onClick={() => fetchData(true)} className="bg-white border border-border p-2.5 rounded-xl shadow-sm hover:bg-gray-50"><RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
                    <div className="relative w-full md:w-64 group">
                        <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3 group-focus-within:text-primary transition-colors" />
                        <input className="input-luxury pl-10" placeholder="Cari Nama / SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={() => { setEditingProduct(null); setModalOpen(true); }} className="btn-gold flex items-center gap-2 shadow-lg hover:shadow-xl"><Plus className="w-4 h-4 stroke-[3px]" /> Product</button>
                </div>
            }/>


            {/* Desktop Table View */}
            <ProductTable
                products={filtered} loading={loading} expandedProductId={expandedProductId} onToggleVariants={toggleVariants}
                variantsCache={variantsCache} loadingVariants={loadingVariants}
                onEdit={(p) => { setEditingProduct(p); setModalOpen(true); }} onDelete={deleteProduct}
            />


            {/* Mobile Card View */}
            <ProductCardList
                products={filtered} loading={loading} expandedProductId={expandedProductId} onToggleVariants={toggleVariants}
                variantsCache={variantsCache} loadingVariants={loadingVariants}
                onEdit={(p) => { setEditingProduct(p); setModalOpen(true); }} onDelete={deleteProduct}
            />


            {/* Modal Form */}
            <Portal>
                <ProductFormModal
                    isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSave}
                    brands={brands} categories={categories} collections={collections}
                    initialData={editingProduct} uploading={uploading}
                />
            </Portal>
        </div>
    );
}