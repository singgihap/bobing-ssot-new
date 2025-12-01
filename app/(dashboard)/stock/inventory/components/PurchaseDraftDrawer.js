"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, X, Package, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

export default function PurchaseDraftDrawer({ isOpen, onClose, cart, onRemove, onOpenFinalize }) {
    if (!isOpen) return null;

    return (
        <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
            <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-border">
                <div className="p-5 border-b border-border flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary"/> Draft Purchase Order</h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-text-secondary"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-text-secondary opacity-50">
                            <Package className="w-12 h-12 mb-2"/>
                            <p>Keranjang kosong.</p>
                        </div>
                    ) : cart.map((item, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-border shadow-sm flex justify-between items-center">
                            <div>
                                <div className="font-bold text-sm text-text-primary">{item.product_name}</div>
                                <div className="text-xs text-text-secondary flex items-center gap-2">
                                    <span className="font-mono bg-gray-100 px-1 rounded">{item.sku}</span>
                                    <span>{item.variant_name}</span>
                                </div>
                                <div className="text-xs font-mono mt-1 text-emerald-600">Est. Cost: {formatRupiah(item.cost)}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="px-2 text-sm font-bold bg-gray-50 border rounded">{item.qty}</span>
                                <button onClick={() => onRemove(i)} className="text-rose-500 p-1 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-5 border-t border-border bg-gray-50">
                    <div className="flex justify-between mb-4 text-sm font-bold">
                        <span>Total Estimasi</span>
                        <span>{formatRupiah(cart.reduce((a,b)=>a+(b.qty*b.cost),0))}</span>
                    </div>
                    <button onClick={onOpenFinalize} disabled={cart.length===0} className="w-full btn-gold py-3 shadow-lg disabled:opacity-50">
                        Finalize PO
                    </button>
                </div>
            </motion.div>
        </>
    );
}