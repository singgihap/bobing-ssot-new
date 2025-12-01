"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowUpRight, ArrowDownLeft, Save } from 'lucide-react';

export default function ManualJournalModal({ isOpen, onClose, onSubmit, accounts, initialData }) {
    const [form, setForm] = useState({
        type: 'out',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        walletId: '',
        categoryId: '',
        description: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const dateStr = initialData.date instanceof Date ? initialData.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                setForm({
                    type: initialData.type,
                    amount: initialData.amount,
                    walletId: initialData.account_id,
                    categoryId: initialData.category_account_id || '',
                    description: initialData.description,
                    date: dateStr
                });
            } else {
                // Reset form
                setForm({
                    type: 'out',
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    walletId: accounts.find(a => a.code.startsWith('1') && (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank')))?.id || '',
                    categoryId: '',
                    description: ''
                });
            }
        }
    }, [isOpen, initialData, accounts]);

    const handleSubmit = () => {
        if(!form.amount || !form.walletId || !form.categoryId) return;
        onSubmit(form);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">
                
                <div className="px-6 py-4 border-b border-border bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">{initialData ? "Edit Jurnal" : "Catat Transaksi"}</h3>
                        <p className="text-xs text-text-secondary">Input manual buku kas (Double Entry).</p>
                    </div>
                    <button onClick={onClose}><X className="w-5 h-5 text-text-secondary hover:text-rose-500 transition-colors"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    
                    {/* 1. TIPE TRANSAKSI */}
                    <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-xl">
                        <button 
                          onClick={() => setForm({...form, type: 'out'})} 
                          className={`py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${form.type === 'out' ? 'bg-white text-rose-600 shadow-md ring-1 ring-rose-100' : 'text-text-secondary hover:bg-gray-200'}`}
                        >
                            <ArrowUpRight className="w-4 h-4"/> Pengeluaran
                        </button>
                        <button 
                          onClick={() => setForm({...form, type: 'in'})} 
                          className={`py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${form.type === 'in' ? 'bg-white text-emerald-600 shadow-md ring-1 ring-emerald-100' : 'text-text-secondary hover:bg-gray-200'}`}
                        >
                            <ArrowDownLeft className="w-4 h-4"/> Pemasukan
                        </button>
                    </div>

                    {/* 2. NOMINAL */}
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Nominal (Rp)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-text-secondary opacity-50">Rp</span>
                            <input 
                              type="number" 
                              autoFocus
                              className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-border rounded-xl text-2xl font-bold outline-none focus:ring-2 focus:bg-white transition-all ${form.type === 'in' ? 'text-emerald-600 focus:ring-emerald-500/20 focus:border-emerald-500' : 'text-rose-600 focus:ring-rose-500/20 focus:border-rose-500'}`} 
                              placeholder="0" 
                              value={form.amount} 
                              onChange={e => setForm({...form, amount: e.target.value})} 
                            />
                        </div>
                    </div>

                    {/* 3. FLOW (DARI -> KE) */}
                    <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-4 relative">
                        <div className="absolute left-[23px] top-[40px] bottom-[40px] w-0.5 bg-blue-200/50 border-l border-dashed border-blue-300"></div>

                        {/* FIELD 1: SUMBER (KREDIT) */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-text-secondary uppercase mb-1.5 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                                {form.type === 'out' ? "Bayar Dari (Kredit)" : "Terima Dari (Kredit)"}
                            </label>
                            <div className="relative z-10">
                                {form.type === 'out' ? (
                                    // OUT: Sumber = Wallet
                                    <select className="input-luxury pl-3 text-sm" value={form.walletId} onChange={e => setForm({...form, walletId: e.target.value})}>
                                        <option value="">-- Pilih Akun Sumber --</option>
                                        {accounts.filter(a => {
                                            const code = String(a.code);
                                            const name = (a.name || '').toLowerCase();
                                            return code.startsWith('11') || code.startsWith('12') || name.includes('kas') || name.includes('bank') || name.includes('saldo');
                                        }).map(a => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    // IN: Sumber = Pendapatan/Lainnya
                                    <select className="input-luxury pl-3 text-sm" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                                        <option value="">-- Pilih Sumber Dana --</option>
                                        {accounts.filter(a => ['4','2','3'].includes(String(a.code).charAt(0)) || a.name.includes('Piutang')).map(a => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* FIELD 2: TUJUAN (DEBIT) */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-text-secondary uppercase mb-1.5 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                {form.type === 'out' ? "Untuk Keperluan (Debit)" : "Masuk Ke Akun (Debit)"}
                            </label>
                            <div className="relative z-10">
                                {form.type === 'out' ? (
                                    // OUT: Tujuan = Beban/Aset/Hutang
                                    <select className="input-luxury pl-3 text-sm" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                                        <option value="">-- Pilih Pos Pengeluaran --</option>
                                        {accounts.filter(a => ['5','1','2','6'].includes(String(a.code).charAt(0)) && !a.name.toLowerCase().includes('kas')).map(a => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    // IN: Tujuan = Wallet
                                    <select className="input-luxury pl-3 text-sm" value={form.walletId} onChange={e => setForm({...form, walletId: e.target.value})}>
                                        <option value="">-- Pilih Akun Kas/Bank --</option>
                                        {accounts.filter(a => String(a.code).startsWith('1') && (a.category?.includes('KAS') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))).map(a => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 4. DETAILS */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Keterangan</label>
                            <input className="input-luxury" placeholder="Contoh: Topup Iklan Shopee" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Tanggal</label>
                            <input type="date" className="input-luxury text-xs px-2" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-border bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="btn-ghost-dark">Batal</button>
                    <button onClick={handleSubmit} className={`btn-primary px-8 shadow-lg ${form.type === 'out' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        <Save className="w-4 h-4 mr-2"/> Simpan
                    </button>
                </div>

            </motion.div>
        </div>
    );
}