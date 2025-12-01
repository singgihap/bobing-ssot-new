"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon, Sparkles } from 'lucide-react';

// Definisikan nilai default di luar komponen
const DEFAULT_FORM = {
    brand_id: '', 
    name: '', 
    base_sku: '',
    category_id: '', 
    collection_id: '',
    status: 'active'
};

export default function ProductFormModal({ 
    isOpen, onClose, onSubmit, 
    brands, categories, collections, 
    initialData, uploading 
}) {
    // FIX: Inisialisasi state dengan DEFAULT_FORM, bukan {}
    const [form, setForm] = useState(DEFAULT_FORM);
    
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    // Reset / Load Form saat modal dibuka
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Merge initialData dengan default agar tidak ada field undefined
                setForm({ ...DEFAULT_FORM, ...initialData });
                setPreviewUrl(initialData.image_url || null);
            } else {
                setForm(DEFAULT_FORM);
                setPreviewUrl(null);
            }
            setImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [isOpen, initialData]);

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) return alert('Harap upload file gambar.');
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(form, imageFile);
    };

    // Render nothing if not open
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-border">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-text-primary">{form.id ? "Edit Produk" : "Produk Baru"}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-400"><X className="w-5 h-5"/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Image Upload Area */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-dashed border-border group hover:border-primary/50 transition-colors">
                        <div className="w-20 h-20 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-border relative">
                            {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" /> : <ImageIcon className="w-6 h-6 text-gray-300"/>}
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
                            <select className="input-luxury" value={form.brand_id || ''} onChange={e=>setForm({...form, brand_id:e.target.value})}>
                                <option value="">-- Pilih --</option>
                                {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary block mb-1">SKU Induk</label>
                            <input className="input-luxury font-mono uppercase" value={form.base_sku || ''} onChange={e=>setForm({...form, base_sku:e.target.value})} placeholder="CODE-001" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-text-secondary block mb-1">Nama Produk</label>
                        <input className="input-luxury" value={form.name || ''} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Contoh: Kemeja Flanel" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-text-secondary block mb-1">Kategori</label>
                            <select className="input-luxury" value={form.category_id || ''} onChange={e=>setForm({...form, category_id:e.target.value})}>
                                <option value="">-- Pilih --</option>
                                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-text-secondary block mb-1 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-500"/> Koleksi
                            </label>
                            <select className="input-luxury" value={form.collection_id || ''} onChange={e=>setForm({...form, collection_id:e.target.value})}>
                                <option value="">-- General --</option>
                                {collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-text-secondary block mb-1">Status</label>
                        <select className="input-luxury" value={form.status || 'active'} onChange={e=>setForm({...form, status:e.target.value})}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div className="pt-4 border-t border-border flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="btn-ghost-dark">Batal</button>
                        <button type="submit" className="btn-gold px-6 shadow-md" disabled={uploading}>
                            {uploading ? 'Menyimpan...' : 'Simpan Produk'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}