"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Image as ImageIcon, Edit, Trash2, Layers, Sparkles } from 'lucide-react';
import { sortBySize, formatRupiah } from '@/lib/utils';

export default function ProductTable({ 
    products, loading, expandedProductId, onToggleVariants, 
    variantsCache, loadingVariants, onEdit, onDelete 
}) {
    return (
        <div className="hidden md:block bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-h-[500px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/80 sticky top-0 z-10 text-[11px] font-bold text-text-secondary uppercase tracking-wider backdrop-blur-sm border-b border-border">
                        <tr>
                            <th className="py-4 pl-6 w-16">Image</th>
                            <th className="py-4 px-4">Product Info</th>
                            <th className="py-4 px-4">SKU Induk</th>
                            <th className="py-4 px-4">Kategori & Koleksi</th>
                            <th className="py-4 px-4 text-center">Status</th>
                            <th className="py-4 px-4 text-right pr-6">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-text-primary divide-y divide-border/60">
                        {loading ? (
                            <tr><td colSpan="6" className="p-12 text-center text-text-secondary animate-pulse">Memuat data produk...</td></tr>
                        ) : products.length === 0 ? (
                            <tr><td colSpan="6" className="p-12 text-center text-text-secondary">Tidak ada data.</td></tr>
                        ) : products.map(p => {
                            const isExpanded = expandedProductId === p.id;
                            return (
                                <React.Fragment key={p.id}>
                                    <tr onClick={() => onToggleVariants(p.id)} className={`cursor-pointer transition-all hover:bg-gray-50/80 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                                        <td className="py-3 pl-6">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-border flex items-center justify-center overflow-hidden">
                                                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-gray-400" />}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-text-primary">{p.name}</div>
                                            <div className="flex items-center gap-1 mt-1 text-primary text-xs font-medium cursor-pointer hover:underline">
                                                Lihat Varian {isExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4"><span className="font-mono text-xs font-bold text-text-secondary bg-gray-100 px-2 py-1 rounded border border-border">{p.base_sku}</span></td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1 text-xs text-text-primary"><Layers className="w-3 h-3 text-text-secondary"/> {p.category_name || '-'}</div>
                                                {p.collection_name && <div className="flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 w-fit"><Sparkles className="w-3 h-3"/> {p.collection_name}</div>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${p.status==='active'?'bg-emerald-50 text-emerald-600 border-emerald-100':'bg-rose-50 text-rose-600 border-rose-100'}`}>{p.status}</span>
                                        </td>
                                        <td className="py-3 px-4 pr-6 text-right">
                                            <div className="flex justify-end gap-2" onClick={e=>e.stopPropagation()}>
                                                <button onClick={() => onEdit(p)} className="p-2 text-text-secondary hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => onDelete(p.id)} className="p-2 text-text-secondary hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                                <td colSpan="6" className="p-0 border-b border-border/50">
                                                    <div className="bg-gray-50/50 p-4 pl-20">
                                                        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-gray-50 text-[10px] uppercase text-text-secondary font-bold">
                                                                    <tr><th className="px-4 py-2">Variant SKU</th><th className="px-4 py-2">Spec</th><th className="px-4 py-2 text-right">HPP</th><th className="px-4 py-2 text-right">Harga Jual</th></tr>
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
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}