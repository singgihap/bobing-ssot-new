"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, query, where, serverTimestamp, orderBy } from 'firebase/firestore';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Portal } from '@/lib/usePortal';

export default function ProductDetailPage({ params }) {
    const { id } = params;
    const [product, setProduct] = useState(null);
    const [variants, setVariants] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({ sku:'', color:'', size:'', cost:0, price:0, weight:0 });

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Get Product
            const pSnap = await getDoc(doc(db, "products", id));
            if (pSnap.exists()) setProduct({ id: pSnap.id, ...pSnap.data() });

            // 2. Get Variants
            const vQ = query(collection(db, "product_variants"), where("product_id", "==", id), orderBy("sku"));
            const vSnap = await getDocs(vQ);
            setVariants(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
            toast.error("Gagal memuat data");
        } finally {
            setLoading(false);
        }
    };

    // --- UPDATE HPP / VARIANT ---
    const handleSaveVariant = async () => {
        const tId = toast.loading("Menyimpan...");
        try {
            const payload = {
                sku: formData.sku,
                color: formData.color,
                size: formData.size,
                cost: Number(formData.cost),
                price: Number(formData.price),
                weight: Number(formData.weight),
                updated_at: serverTimestamp()
            };

            if (formData.id) {
                // Edit
                await updateDoc(doc(db, "product_variants", formData.id), payload);
            } else {
                // Add New
                await addDoc(collection(db, "product_variants"), {
                    ...payload,
                    product_id: id,
                    status: 'active',
                    created_at: serverTimestamp()
                });
            }

            // Clean Cache
            if(typeof window !== 'undefined') localStorage.removeItem('lumina_variants_v2');
            
            toast.success("Berhasil disimpan!", { id: tId });
            setModalOpen(false);
            fetchData();
        } catch (e) {
            toast.error(e.message, { id: tId });
        }
    };

    if (loading) return <div className="text-center py-10 text-text-secondary animate-pulse">Loading Product Data...</div>;
    if (!product) return <div className="text-center py-10">Produk tidak ditemukan</div>;

    return (
        <div className="max-w-5xl mx-auto pb-20 space-y-6">
            <PageHeader title={product.name} subtitle={`Base SKU: ${product.base_sku} • ${variants.length} Varian`}>
                <Link href="/catalog/products" className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-2">
                    &larr; Kembali
                </Link>
            </PageHeader>

            {/* TABEL VARIAN */}
            <div className="card-luxury overflow-hidden bg-surface border-lumina-border">
                <div className="px-6 py-4 border-b border-lumina-border flex justify-between items-center bg-background">
                    <h3 className="font-bold text-text-primary">Daftar Varian & Harga</h3>
                    <button 
                        onClick={() => { 
                            setFormData({ sku: `${product.base_sku}-`, color:'', size:'', cost:0, price:0, weight:0 }); 
                            setModalOpen(true); 
                        }}
                        className="btn-gold px-4 py-2 text-xs"
                    >
                        + Tambah Varian
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="table-dark w-full">
                        <thead>
                            <tr className="text-xs text-text-secondary uppercase bg-surface">
                                <th className="pl-6 py-3">SKU</th>
                                <th>Warna / Size</th>
                                <th className="text-right text-rose-400">HPP (Modal)</th>
                                <th className="text-right text-emerald-400">Harga Jual</th>
                                <th className="text-right pr-6">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {variants.map(v => (
                                <tr key={v.id} className="border-b border-lumina-border/50 hover:bg-lumina-highlight/10">
                                    <td className="pl-6 py-3 font-mono font-bold text-lumina-gold">{v.sku}</td>
                                    <td className="text-text-primary">{v.color} / {v.size}</td>
                                    {/* Highlight HPP 0 agar admin sadar */}
                                    <td className={`text-right font-mono font-bold ${!v.cost ? 'text-rose-500 bg-rose-500/10' : 'text-text-secondary'}`}>
                                        {formatRupiah(v.cost)}
                                    </td>
                                    <td className="text-right font-mono font-bold text-emerald-400">{formatRupiah(v.price)}</td>
                                    <td className="text-right pr-6">
                                        <button 
                                            onClick={() => { setFormData(v); setModalOpen(true); }}
                                            className="text-xs border border-lumina-border px-3 py-1.5 rounded hover:bg-white hover:text-black transition-colors"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL EDIT/ADD */}
            <Portal>
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-surface border border-lumina-border rounded-xl shadow-2xl w-full max-w-md">
                            <div className="p-5 border-b border-lumina-border flex justify-between items-center">
                                <h3 className="font-bold text-text-primary">{formData.id ? 'Edit Varian' : 'Tambah Varian Baru'}</h3>
                                <button onClick={() => setModalOpen(false)} className="text-xl">✕</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary">SKU Final</label>
                                    <input className="input-luxury w-full font-mono mt-1" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-text-secondary">Warna</label>
                                        <input className="input-luxury w-full mt-1" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-text-secondary">Size</label>
                                        <input className="input-luxury w-full mt-1" value={formData.size} onChange={e => setFormData({ ...formData, size: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-rose-500 uppercase">HPP (Modal)</label>
                                        <input type="number" className="input-luxury w-full mt-1 text-rose-500 border-rose-500/30" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-emerald-500 uppercase">Harga Jual</label>
                                        <input type="number" className="input-luxury w-full mt-1 text-emerald-500 border-emerald-500/30" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 border-t border-lumina-border flex justify-end gap-3 bg-background rounded-b-xl">
                                <button onClick={() => setModalOpen(false)} className="btn-ghost-dark">Batal</button>
                                <button onClick={handleSaveVariant} className="btn-gold px-6">Simpan</button>
                            </div>
                        </div>
                    </div>
                )}
            </Portal>
        </div>
    );
}