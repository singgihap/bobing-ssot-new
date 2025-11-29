"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, getDocs, where } from 'firebase/firestore';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

// Komponen Form dibungkus Suspense agar aman baca useSearchParams
function CreateProductForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramSku = searchParams.get('sku') || '';

    const [loading, setLoading] = useState(false);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);

    // State Form Produk Induk
    const [product, setProduct] = useState({
        name: '',
        base_sku: '',
        brand_name: '',
        category_name: '',
        description: ''
    });

    // State Form Varian Pertama
    const [variant, setVariant] = useState({
        color: '',
        size: '',
        price: 0,
        cost: 0,
        weight: 0
    });

    // --- 1. AUTO FILL DARI URL ---
    useEffect(() => {
        if (paramSku) {
            // Logika menebak Base SKU, Warna, Size dari string SKU (Misal: KEMEJA-MERAH-L)
            const parts = paramSku.split('-');
            if (parts.length >= 3) {
                setProduct(p => ({ ...p, base_sku: parts[0] })); // Base: KEMEJA
                setVariant(v => ({ ...v, color: parts[1], size: parts.slice(2).join('-') })); // Warna: MERAH, Size: L
            } else if (parts.length === 2) {
                setProduct(p => ({ ...p, base_sku: parts[0] }));
                setVariant(v => ({ ...v, size: parts[1] }));
            } else {
                setProduct(p => ({ ...p, base_sku: paramSku }));
            }
            toast("Form diisi otomatis dari Import Error", { icon: '🤖' });
        }
    }, [paramSku]);

    // --- 2. LOAD MASTER DATA (BRAND/CATEGORY) ---
    useEffect(() => {
        const fetchMasters = async () => {
            const bSnap = await getDocs(collection(db, "brands"));
            const cSnap = await getDocs(collection(db, "categories"));
            setBrands(bSnap.docs.map(d => d.data().name));
            setCategories(cSnap.docs.map(d => d.data().name));
        };
        fetchMasters();
    }, []);

    // --- 3. SIMPAN DATA (ATOMIC LIKE) ---
    const handleSubmit = async () => {
        if (!product.name || !product.base_sku) return toast.error("Nama & Base SKU Wajib!");
        
        setLoading(true);
        try {
            // A. Simpan Produk Induk
            const prodRef = await addDoc(collection(db, "products"), {
                ...product,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });

            // B. Simpan Varian Pertama (Jika diisi)
            if (variant.price > 0 || variant.cost > 0) {
                // Generate SKU Varian Final
                const finalSku = paramSku || `${product.base_sku}-${variant.color}-${variant.size}`.toUpperCase().replace(/--/g, '-');
                
                await addDoc(collection(db, "product_variants"), {
                    product_id: prodRef.id,
                    sku: finalSku,
                    color: variant.color,
                    size: variant.size,
                    price: Number(variant.price),
                    cost: Number(variant.cost),
                    weight: Number(variant.weight),
                    status: 'active',
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp()
                });
            }

            // Invalidate Cache Import agar SKU ini langsung dikenali
            if (typeof window !== 'undefined') {
                localStorage.removeItem('lumina_variants_v2'); 
                localStorage.removeItem('lumina_products_base_v2');
            }

            toast.success("Produk & Varian Berhasil Dibuat!");
            
            // Opsi: Tutup tab jika dibuka dari import, atau redirect
            if (paramSku) {
                setTimeout(() => window.close(), 1500); // Auto close tab untuk efisiensi admin
            } else {
                router.push('/catalog/products');
            }

        } catch (e) {
            console.error(e);
            toast.error("Gagal menyimpan: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* ALERT JIKA DARI IMPORT */}
            {paramSku && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 shadow-sm animate-pulse">
                    <span className="text-xl">⚠️</span>
                    <div>
                        <p className="font-bold text-sm">Mode Perbaikan Data (Missing SKU)</p>
                        <p className="text-xs">Sistem mendeteksi SKU <b>{paramSku}</b> belum terdaftar. Silakan lengkapi data di bawah.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* --- KOLOM KIRI: INFO PRODUK --- */}
                <div className="card-luxury p-6 bg-surface border-lumina-border h-full">
                    <h3 className="text-lg font-bold text-text-primary mb-4 border-b border-lumina-border pb-2">1. Info Produk Induk</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase">Nama Produk <span className="text-rose-500">*</span></label>
                            <input className="input-luxury w-full mt-1" placeholder="Contoh: Kemeja Flanel Kotak" value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} autoFocus />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase">Base SKU (Kode Induk) <span className="text-rose-500">*</span></label>
                            <input className="input-luxury w-full mt-1 font-mono uppercase" placeholder="Contoh: KMJ-FLANEL" value={product.base_sku} onChange={e => setProduct({ ...product, base_sku: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase">Kategori</label>
                                <input className="input-luxury w-full mt-1" list="cat-list" value={product.category_name} onChange={e => setProduct({ ...product, category_name: e.target.value })} />
                                <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase">Brand</label>
                                <input className="input-luxury w-full mt-1" list="brand-list" value={product.brand_name} onChange={e => setProduct({ ...product, brand_name: e.target.value })} />
                                <datalist id="brand-list">{brands.map(b => <option key={b} value={b} />)}</datalist>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- KOLOM KANAN: VARIAN PERTAMA --- */}
                <div className="card-luxury p-6 bg-surface border-lumina-border h-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-lumina-gold text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl">AUTO-CREATE VARIANT</div>
                    <h3 className="text-lg font-bold text-text-primary mb-4 border-b border-lumina-border pb-2">2. Varian Pertama ({paramSku || 'Baru'})</h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase">Warna</label>
                                <input className="input-luxury w-full mt-1" placeholder="Hitam / Merah" value={variant.color} onChange={e => setVariant({ ...variant, color: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase">Ukuran</label>
                                <input className="input-luxury w-full mt-1" placeholder="L / XL / 42" value={variant.size} onChange={e => setVariant({ ...variant, size: e.target.value })} />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-background rounded-xl border border-lumina-border space-y-3">
                            <div>
                                <label className="text-xs font-bold text-emerald-600 uppercase">Harga Jual (Price)</label>
                                <input type="number" className="input-luxury w-full mt-1 text-emerald-600 font-bold" value={variant.price} onChange={e => setVariant({ ...variant, price: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-rose-500 uppercase">Harga Modal (HPP)</label>
                                <input type="number" className="input-luxury w-full mt-1 text-rose-500" value={variant.cost} onChange={e => setVariant({ ...variant, cost: e.target.value })} />
                                <p className="text-[10px] text-text-secondary mt-1">*Penting untuk perhitungan profit Import</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end gap-4 border-t border-lumina-border pt-6">
                <Link href="/catalog/products" className="btn-ghost-dark px-6 py-3">Batal</Link>
                <button onClick={handleSubmit} disabled={loading} className="btn-gold px-8 py-3 shadow-lg hover:scale-105 transition-transform">
                    {loading ? 'Menyimpan...' : '💾 SIMPAN PRODUK & VARIAN'}
                </button>
            </div>
        </div>
    );
}

export default function CreateProductPage() {
    return (
        <>
            <PageHeader title="Buat Produk Baru" subtitle="Input Produk Induk & Varian Awal secara bersamaan." />
            <Suspense fallback={<div className="p-10 text-center">Loading Form...</div>}>
                <CreateProductForm />
            </Suspense>
        </>
    );
}