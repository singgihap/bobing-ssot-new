"use client";
import React from 'react';
import { motion } from 'framer-motion';

export default function AdjustmentModal({ variant, isOpen, onClose, onSave, form, setForm }) {
    if (!isOpen || !variant) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-border">
                <h3 className="text-lg font-bold text-text-primary mb-1">Stok Opname</h3>
                <p className="text-xs text-text-secondary mb-4 font-mono">{variant.sku}</p>
                <div className="space-y-4">
                    <div className="flex justify-between bg-gray-50 p-3 rounded-xl border border-border">
                        <span className="text-xs font-bold text-text-secondary uppercase">Sistem</span>
                        <span className="text-sm font-mono font-bold text-text-primary">{variant.current_qty}</span>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-emerald-600 block mb-1">Real Qty (Fisik)</label>
                        <input type="number" className="w-full text-center text-3xl font-bold border-2 border-emerald-500/50 rounded-xl py-3 focus:outline-none text-emerald-600" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} autoFocus />
                    </div>
                    <textarea className="w-full border border-border rounded-xl p-3 text-sm focus:outline-none" rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Catatan..."></textarea>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="btn-ghost-dark px-4 py-2 text-xs">Batal</button>
                    <button onClick={onSave} className="btn-primary text-white hover:bg-blue-600 px-6 py-2 rounded-xl text-xs font-bold shadow-lg">Simpan</button>
                </div>
            </motion.div>
        </div>
    );
}