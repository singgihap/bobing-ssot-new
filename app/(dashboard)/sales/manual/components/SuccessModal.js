"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

export default function SuccessModal({ data, onClose, onPrint }) {
    if (!data) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
             <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white max-w-sm w-full rounded-[20px] shadow-2xl relative overflow-hidden border border-border">
                <div className="bg-emerald-500 p-6 text-center text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm"><Package className="w-8 h-8 text-white" /></div>
                    <h2 className="text-xl font-bold font-display">Transaksi Berhasil!</h2>
                    <p className="text-xs text-emerald-100 mt-1 font-mono opacity-90">{data.id}</p>
                </div>
                <div className="p-6 bg-white relative">
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm border-b border-dashed border-gray-200 pb-3"><span className="text-text-secondary">Customer</span><span className="font-bold text-text-primary">{data.customer}</span></div>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {data.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-text-secondary"><span>{item.qty}x {item.name}</span><span className="font-mono text-text-primary">{formatRupiah(item.qty * item.price)}</span></div>
                            ))}
                        </div>
                        <div className="border-t-2 border-dashed border-gray-200 pt-3 space-y-1">
                            <div className="flex justify-between text-sm"><span className="text-text-secondary">Total Tagihan</span><span className="font-bold text-text-primary">{formatRupiah(data.total)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-text-secondary">Tunai</span><span className="font-mono">{formatRupiah(data.received)}</span></div>
                        </div>
                        <div className="bg-emerald-5 rounded-lg p-3 flex justify-between items-center border border-emerald-100">
                            <span className="text-xs font-bold text-emerald-700 uppercase">Kembali</span>
                            <span className="text-lg font-bold text-emerald-700">{formatRupiah(Math.max(0, data.change))}</span>
                        </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                        <button onClick={onPrint} className="flex-1 py-3 bg-white border border-gray-200 text-text-primary hover:bg-gray-50 rounded-xl text-sm font-bold transition-colors shadow-sm">Cetak</button>
                        <button onClick={onClose} className="flex-1 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg">Baru</button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}