"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function StockCardModal({ isOpen, onClose, variant, history }) {
    if (!isOpen || !variant) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[80vh] overflow-hidden">
                <div className="p-5 border-b border-border flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="font-bold text-lg text-text-primary">Kartu Stok</h3>
                        <p className="text-xs text-text-secondary font-mono mt-0.5">{variant.sku}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-border hover:bg-gray-100 transition-colors text-text-secondary">
                        <ChevronDown className="w-4 h-4"/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-white text-xs font-bold text-text-secondary uppercase sticky top-0 border-b border-border shadow-sm z-10">
                            <tr><th className="p-4 pl-6">Tanggal</th><th className="p-4">Tipe</th><th className="p-4 text-right">Qty</th><th className="p-4">Note</th></tr>
                        </thead>
                        <tbody className="text-sm">
                            {!history ? (
                                <tr><td colSpan="4" className="text-center p-8 text-text-secondary animate-pulse">Loading history...</td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan="4" className="text-center p-8 text-text-secondary italic">Belum ada riwayat pergerakan.</td></tr>
                            ) : (
                                history.map((m, idx) => (
                                    <tr key={m.id || idx} className="hover:bg-gray-50 border-b border-border/50 last:border-0 transition-colors">
                                        <td className="pl-6 p-4 text-xs text-text-secondary font-mono">
                                            {m.date ? new Date(m.date.toDate()).toLocaleDateString() + ' ' + new Date(m.date.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-gray-100 text-text-primary px-2 py-1 rounded text-[10px] uppercase font-bold border border-border">
                                                {m.type?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className={`p-4 text-right font-mono font-bold ${m.qty > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {m.qty > 0 ? `+${m.qty}` : m.qty}
                                        </td>
                                        <td className="p-4 text-xs text-text-secondary truncate max-w-[200px]">{m.notes || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}