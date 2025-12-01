"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Image as ImageIcon, Edit, Trash2 } from 'lucide-react';
import Skeleton from '@/components/Skeleton';
import { sortBySize, formatRupiah } from '@/lib/utils';

export default function ProductCardList({
    products, loading, expandedProductId, onToggleVariants,
    variantsCache, loadingVariants, onEdit, onDelete
}) {
    return (
        <div className="md:hidden space-y-3">
            {loading ? <Skeleton className="h-32"/> : 
             products.length === 0 ? <div className="text-center p-8 text-text-secondary">Tidak ada data.</div> :
             products.map(p => {
                const isExpanded = expandedProductId === p.id;
                return (
                    <div key={p.id} className="bg-white p-4 rounded-xl border border-border shadow-sm active:scale-[0.99] transition-transform">
                        <div className="flex justify-between items-start" onClick={() => onToggleVariants(p.id)}>
                            <div className="flex gap-3 overflow-hidden min-w-0"> {/* Tambahkan min-w-0 di sini untuk flex child */}
                                {/* Container gambar dengan dimensi tetap */}
                                <div 
                                    className="aspect-square bg-gray-100 border border-border rounded-lg overflow-hidden shrink-0 flex-shrink-0"
                                    style={{ width: '48px', height: '48px' }} // Dimensi tetap 48x48px
                                >
                                    {p.image_url ? (
                                        <img 
                                            src={p.image_url} 
                                            alt={p.name}
                                            className="w-full h-full object-cover block" // Tambahkan 'block' untuk display: block
                                            loading="lazy" // Pindahkan ke atribut HTML
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="min-w-0 flex-1"> {/* flex-1 untuk mengisi sisa ruang */}
                                    <h4 className="font-bold text-text-primary text-sm leading-tight truncate">{p.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-mono bg-gray-100 text-text-secondary px-1.5 py-0.5 rounded border border-border">{p.base_sku}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase ${p.status==='active'?'bg-emerald-50 border-emerald-100 text-emerald-700':'bg-rose-50 border-rose-100 text-rose-700'}`}>{p.status}</span>
                                    </div>
                                    <p className="text-[10px] text-text-secondary mt-1 truncate">{p.brand_name} • {p.category_name}</p>
                                </div>
                            </div>
                            <div className={`transition-transform shrink-0 ml-2 ${isExpanded ? 'rotate-90' : ''}`}>
                                <ChevronRight className="w-5 h-5 text-text-secondary"/>
                            </div>
                        </div>

                        {/* Bagian Varian (Tidak berubah) */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} className="mt-4 pt-4 border-t border-dashed border-gray-200 overflow-hidden">
                                    {loadingVariants ? <p className="text-center text-xs py-2">Loading variants...</p> : 
                                     (variantsCache[p.id]||[]).sort(sortBySize).map(v => (
                                        <div key={v.id} className="flex justify-between items-center text-xs py-2 border-b border-gray-50 last:border-0">
                                            <div>
                                                <span className="font-bold text-primary mr-2">{v.sku}</span>
                                                <span className="text-gray-500">{v.color}/{v.size}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-emerald-600">{formatRupiah(v.price)}</div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <div className="flex gap-2 mt-4 pt-2 border-t border-border">
                                        <button onClick={() => onEdit(p)} className="flex-1 py-2 rounded-lg bg-gray-50 border border-border text-xs font-bold text-text-secondary hover:bg-gray-100 flex items-center justify-center gap-2">
                                            <Edit className="w-3.5 h-3.5"/> Edit
                                        </button>
                                        <button onClick={() => onDelete(p.id)} className="flex-1 py-2 rounded-lg bg-rose-50 border border-rose-100 text-xs font-bold text-rose-600 hover:bg-rose-100 flex items-center justify-center gap-2">
                                            <Trash2 className="w-3.5 h-3.5"/> Hapus
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            })}
        </div>
    );
}
