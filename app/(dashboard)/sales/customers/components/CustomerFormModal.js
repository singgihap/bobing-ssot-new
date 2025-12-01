"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { X, User, Phone, MapPin } from 'lucide-react';

export default function CustomerFormModal({ isOpen, onClose, onSubmit, form, setForm, isEditing }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-5 border-b border-border bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">{isEditing ? 'Edit Customer' : 'New Customer'}</h3>
                        <p className="text-xs text-text-secondary mt-0.5">Manage details and classification.</p>
                    </div>
                    <button onClick={onClose} className="bg-white p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500 transition-all shadow-sm"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 space-y-5 bg-white">
                    <div className="space-y-4">
                        <div className="group">
                            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Nama Lengkap</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                                <input required className="input-luxury pl-10" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama Pelanggan" autoFocus />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="group">
                                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Tipe</label>
                                <select className="input-luxury cursor-pointer" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                                    <option value="end_customer">Umum</option>
                                    <option value="reseller">Reseller</option>
                                    <option value="vip">VIP</option>
                                </select>
                            </div>
                            <div className="group">
                                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">No. HP</label>
                                <input className="input-luxury font-mono" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="08..." />
                            </div>
                        </div>

                        <div className="group">
                            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Alamat Lengkap</label>
                            <textarea rows="3" className="input-luxury resize-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Alamat pengiriman..."></textarea>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-50 border border-transparent hover:border-border transition-all">Batal</button>
                        <button onClick={onSubmit} className="btn-gold px-6 py-2.5 shadow-md">Simpan Data</button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}