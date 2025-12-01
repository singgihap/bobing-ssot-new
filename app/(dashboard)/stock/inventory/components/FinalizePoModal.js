"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { X, AlertCircle, FileText } from 'lucide-react';

export default function FinalizePoModal({ isOpen, onClose, onSubmit, suppliers, warehouses, form, setForm }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-border">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-text-primary">Create Purchase Order</h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-text-secondary"/></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Supplier</label>
                        <select className="input-luxury" value={form.supplier_id} onChange={e=>setForm({...form, supplier_id:e.target.value})}>
                            <option value="">-- Pilih Supplier --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Gudang Tujuan</label>
                        <select className="input-luxury" value={form.warehouse_id} onChange={e=>setForm({...form, warehouse_id:e.target.value})}>
                            <option value="">-- Pilih Gudang --</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Tanggal Order</label>
                        <input type="date" className="input-luxury" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5"/>
                        <div className="text-xs text-amber-800">
                            <p className="font-bold">Konfirmasi Stok Masuk?</p>
                            <p>Stok akan langsung ditambahkan dengan status <b>Received</b>. Jurnal Hutang akan tercatat otomatis.</p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                    <button onClick={onClose} className="btn-ghost-dark">Batal</button>
                    <button onClick={onSubmit} className="btn-primary text-white hover:bg-blue-600 px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2">
                        <FileText className="w-4 h-4"/> Create PO
                    </button>
                </div>
            </motion.div>
        </div>
    );
}