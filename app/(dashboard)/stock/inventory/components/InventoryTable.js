"use client";
import React from 'react';
import { ChevronRight, Plus, ClipboardList, History, Warehouse } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatRupiah, sortBySize } from '@/lib/utils';

export default function InventoryTable({ 
    loading, products, warehouses, snapshots, 
    expandedProductId, setExpandedProductId,
    onAddToCart, onOpenAdjustment, onOpenHistory,
    totalAssetValue 
}) {
    const getProductTotalStock = (product, whId) => product.variants.reduce((acc, v) => acc + (snapshots[`${v.id}_${whId}`] || 0), 0);
    const getProductGlobalStock = (product) => warehouses.reduce((acc, w) => acc + getProductTotalStock(product, w.id), 0);

    return (
        <div className="hidden md:block bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-h-[500px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/80 sticky top-0 z-10 text-[11px] font-bold text-text-secondary uppercase tracking-wider backdrop-blur-sm border-b border-border">
                        <tr>
                            <th className="py-4 pl-6 w-[350px]">Produk / SKU</th>
                            {warehouses.map(w => (
                                <th key={w.id} className="py-4 px-2 text-center min-w-[120px] border-l border-border/50">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-1"><Warehouse className="w-3.5 h-3.5 opacity-50" /><span>{w.name}</span></div>
                                    </div>
                                </th>
                            ))}
                            <th className="py-4 px-4 text-center min-w-[150px] border-l border-border/50 bg-emerald-50/50 text-emerald-800">
                                Total Asset<br/><span className="text-[10px] font-normal opacity-70">({formatRupiah(totalAssetValue)})</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-text-primary divide-y divide-border/60">
                        {loading ? <tr><td colSpan={warehouses.length+2} className="p-12 text-center text-text-secondary animate-pulse">Memuat data stok...</td></tr> : 
                         products.length===0 ? <tr><td colSpan={warehouses.length+2} className="p-12 text-center">Tidak ada produk ditemukan.</td></tr> : 
                         products.map(prod => {
                            const isExpanded = expandedProductId === prod.id;
                            const globalTotal = getProductGlobalStock(prod);
                            return (
                                <React.Fragment key={prod.id}>
                                    <tr className={`cursor-pointer hover:bg-gray-50/80 ${isExpanded ? 'bg-blue-50/40 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`} onClick={() => setExpandedProductId(isExpanded ? null : prod.id)}>
                                        <td className="py-3 pl-4 pr-2">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 transition-transform ${isExpanded ? 'rotate-90 text-primary' : 'text-text-secondary'}`}><ChevronRight className="w-4 h-4"/></div>
                                                <div><div className="font-bold text-text-primary text-sm line-clamp-1">{prod.name}</div><div className="flex items-center gap-2 mt-1"><span className="text-[10px] font-mono text-text-secondary bg-gray-100 px-1.5 py-0.5 rounded border border-border">{prod.base_sku}</span></div></div>
                                            </div>
                                        </td>
                                        {warehouses.map(w => {
                                            const totalWh = getProductTotalStock(prod, w.id);
                                            return <td key={w.id} className="py-3 px-2 text-center border-l border-border/50"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${totalWh > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{totalWh}</span></td>
                                        })}
                                        <td className="py-3 px-4 text-center border-l border-border/50 bg-emerald-50/10"><span className="font-bold text-sm text-emerald-700">{globalTotal}</span></td>
                                    </tr>
                                    <AnimatePresence>
                                        {isExpanded && prod.variants.sort(sortBySize).map(v => (
                                            <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-gray-50/30 border-b border-border/30 hover:bg-blue-50/20 group">
                                                <td className="py-2 pl-12 pr-2">
                                                    <div className="flex items-center gap-3"><div className="w-1 h-8 bg-border/50 rounded-full"></div><div className="flex-1"><div className="flex items-center gap-2"><span className="font-mono text-[11px] font-bold text-primary">{v.sku}</span><span className="text-xs text-text-secondary">{v.color} / {v.size}</span></div></div><button onClick={(e) => { e.stopPropagation(); onAddToCart(v, prod); }} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded hover:bg-amber-100 font-bold shadow-sm"><Plus className="w-3 h-3"/> PO</button></div>
                                                </td>
                                                {warehouses.map(w => {
                                                    const qty = snapshots[`${v.id}_${w.id}`] || 0;
                                                    return <td key={w.id} className="py-2 px-2 text-center border-l border-border/30 relative group/cell"><span className={`text-sm font-mono font-bold ${qty < 0 ? 'text-rose-500' : qty === 0 ? 'text-gray-300' : 'text-emerald-600'}`}>{qty}</span><div className="opacity-0 group-hover/cell:opacity-100 absolute inset-0 flex items-center justify-center bg-white/95 gap-1 transition-opacity border-l border-border/30 backdrop-blur-[1px]"><button onClick={(e) => { e.stopPropagation(); onOpenAdjustment(v, w.id); }} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100" title="Opname"><ClipboardList className="w-3.5 h-3.5"/></button><button onClick={(e) => { e.stopPropagation(); onOpenHistory(v, w.id); }} className="p-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm" title="Kartu Stok"><History className="w-3.5 h-3.5"/></button></div></td>
                                                })}
                                                <td className="py-2 px-4 text-center border-l border-border/30 bg-emerald-50/10"><span className="text-xs text-text-secondary font-mono">{warehouses.reduce((acc, w) => acc + (snapshots[`${v.id}_${w.id}`] || 0), 0)}</span></td>
                                            </motion.tr>
                                        ))}
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