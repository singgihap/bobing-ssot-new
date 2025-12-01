"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import { sortBySize, formatRupiah } from '@/lib/utils';

export default function VariantModal({ product, snapshots, selectedWh, onClose, onAddToCart }) {
    if (!product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] border border-border overflow-hidden">
                <div className="p-6 border-b border-border bg-gray-50 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20 uppercase">Select Variant</span>
                            <span className="text-xs font-mono text-text-secondary">{product.base_sku}</span>
                        </div>
                        <h3 className="font-display font-bold text-text-primary text-xl">{product.name}</h3>
                    </div>
                    <button onClick={onClose} className="bg-white p-2 rounded-xl border border-border hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-2">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white text-xs font-bold text-text-secondary uppercase sticky top-0 z-10 shadow-sm">
                            <tr><th className="pl-6 py-4">Varian</th><th className="text-right py-4">Harga</th><th className="text-center py-4">Stok</th><th className="pr-6 text-right py-4">Aksi</th></tr>
                        </thead>
                        <tbody className="text-sm">
                            {product.variants.sort(sortBySize).map((v) => { 
                                const qty = snapshots[`${v.id}_${selectedWh}`] || 0; 
                                return (
                                    <tr key={v.id} className="border-b border-border/50 last:border-0 hover:bg-blue-50/30 transition-colors">
                                        <td className="pl-6 py-4"><div className="font-medium text-text-primary">{v.color}</div><div className="text-xs text-text-secondary font-mono mt-0.5">{v.size}</div></td>
                                        <td className="text-right font-mono font-medium text-text-primary">{formatRupiah(v.price)}</td>
                                        <td className="text-center"><span className={`px-2.5 py-1 rounded-md text-xs font-bold ${qty>0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{qty}</span></td>
                                        <td className="pr-6 text-right">
                                            <button disabled={qty<=0} onClick={()=>onAddToCart(v, product.name)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ml-auto shadow-sm ${qty>0 ? 'bg-primary text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                                <Plus className="w-3.5 h-3.5" /> Pilih
                                            </button>
                                        </td>
                                    </tr> 
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}