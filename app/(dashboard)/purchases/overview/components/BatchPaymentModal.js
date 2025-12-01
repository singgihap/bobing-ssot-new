"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export default function BatchPaymentModal({ isOpen, onClose, onExecute, wallets }) {
    const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                    <Zap className="w-6 h-6"/>
                    <h3 className="font-bold text-lg">Dev Batch Payment</h3>
                </div>
                <p className="text-sm text-text-secondary mb-4">
                    Fitur ini akan mengubah semua status <b>UNPAID</b> menjadi <b>PAID</b> dan memotong saldo akun yang dipilih.
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-text-secondary block mb-1">Sumber Dana (Wallet)</label>
                        <select 
                            className="input-luxury" 
                            value={selectedWalletId} 
                            onChange={e => setSelectedWalletId(e.target.value)}
                        >
                            <option value="">-- Pilih Akun --</option>
                            {wallets.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="btn-ghost-dark text-xs">Batal</button>
                        <button onClick={() => onExecute(selectedWalletId)} className="btn-gold text-xs px-4 shadow-md">Execute Batch</button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}