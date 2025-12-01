"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, X } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

export default function ReceivablePaymentModal({ isOpen, onClose, onSubmit, form, setForm, wallets, debtAmount, loading }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-emerald-800">Terima Pembayaran</h3>
                        <p className="text-xs text-emerald-600 font-medium">{form.customerName}</p>
                    </div>
                    <button onClick={onClose}><X className="w-5 h-5 text-emerald-700 hover:bg-emerald-100 rounded"/></button>
                </div>
                
                <div className="p-6 space-y-5">
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Nominal Diterima</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-text-secondary font-bold">Rp</span>
                            <input 
                                type="number" 
                                className="input-luxury pl-10 text-lg font-bold text-emerald-600" 
                                value={form.amount} 
                                onChange={e => setForm({...form, amount: e.target.value})} 
                                autoFocus
                            />
                        </div>
                        <p className="text-[10px] text-text-secondary mt-1">
                            Total Piutang: <span className="font-bold text-blue-600">{formatRupiah(debtAmount || 0)}</span>
                        </p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Masuk Ke Kas</label>
                        <div className="relative">
                            <Wallet className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/>
                            <select className="input-luxury pl-9" value={form.walletId} onChange={e => setForm({...form, walletId: e.target.value})}>
                                <option value="">-- Pilih Kas / Bank --</option>
                                {wallets.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button onClick={onClose} className="btn-ghost-dark text-xs">Batal</button>
                        <button onClick={onSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-70">
                            {loading ? 'Memproses...' : 'Terima Sekarang'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}