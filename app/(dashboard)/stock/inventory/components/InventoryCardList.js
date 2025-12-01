"use client";
import React from 'react';
import { ChevronRight, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// 👇 BAGIAN PENTING: Tambahkan import Skeleton ini
import Skeleton from '@/components/Skeleton'; 
import { sortBySize } from '@/lib/utils';

export default function InventoryCardList({
    loading, products, warehouses, snapshots,
    expandedProductId, setExpandedProductId,
    onAddToCart, onOpenAdjustment
}) {
    // Helper hitung stok
    const getProductTotalStock = (product, whId) => product.variants.reduce((acc, v) => acc + (snapshots[`${v.id}_${whId}`] || 0), 0);
    const getProductGlobalStock = (product) => warehouses.reduce((acc, w) => acc + getProductTotalStock(product, w.id), 0);

    return (
        <div className="md:hidden space-y-3 pb-4">
            {/* Skeleton digunakan di sini saat loading */}
            {loading ? <Skeleton className="h-32"/> : 
             products.length === 0 ? <div className="text-center p-8 text-gray-400">Tidak ada produk</div> :
             products.map(prod => {
                const isExpanded = expandedProductId === prod.id;
                const globalTotal = getProductGlobalStock(prod);
                return (
                    <div key={prod.id} className="bg-white p-4 rounded-xl border border-border shadow-sm active:scale-[0.99] transition-transform" onClick={() => setExpandedProductId(isExpanded ? null : prod.id)}>
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className={`mt-1 transition-transform ${isExpanded ? 'rotate-90 text-primary' : 'text-gray-300'}`}><ChevronRight className="w-5 h-5"/></div>
                                <div>
                                    <h4 className="font-bold text-text-primary text-sm leading-tight">{prod.name}</h4>
                                    <span className="text-[10px] font-mono bg-gray-100 text-text-secondary px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block">{prod.base_sku}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className={`text-lg font-bold ${globalTotal > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{globalTotal}</span>
                                <p className="text-[9px] text-gray-400 uppercase">Total Qty</p>
                            </div>
                        </div>
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} className="mt-3 pt-3 border-t border-dashed border-gray-200 overflow-hidden">
                                    {prod.variants.sort(sortBySize).map(v => (
                                        <div key={v.id} className="bg-gray-50 p-3 rounded-lg mb-2 last:mb-0">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-xs text-primary">{v.sku}</span><span className="text-xs text-text-secondary">{v.color} / {v.size}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {warehouses.map(w => {
                                                    const qty = snapshots[`${v.id}_${w.id}`] || 0;
                                                    return (
                                                        <button key={w.id} onClick={(e)=>{e.stopPropagation(); onOpenAdjustment(v, w.id)}} className="flex justify-between items-center bg-white border border-gray-200 px-2 py-1.5 rounded text-[10px]">
                                                            <span className="truncate max-w-[60px] text-gray-500">{w.name}</span>
                                                            <span className={`font-bold ${qty>0?'text-emerald-600':'text-rose-500'}`}>{qty}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); addToPoCart(v, prod)}} className="w-full mt-2 bg-blue-100 text-blue-700 text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1"><ShoppingCart className="w-3 h-3"/> Tambah PO</button>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            })}
        </div>
    );
}