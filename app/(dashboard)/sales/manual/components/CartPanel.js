"use client";
import React, { useState } from 'react';
import { ShoppingCart, Trash2, ArrowLeft, User, Plus, X, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatRupiah } from '@/lib/utils';
import { NumericFormat } from 'react-number-format';

export default function CartPanel({ 
    cart, customers, accounts, 
    onUpdateQty, onRemove, onClear, onCheckout, 
    selectedCustId, setSelectedCustId, 
    paymentAccId, setPaymentAccId,
    cashReceived, setCashReceived,
    onOpenCustomerModal, activeMobileTab, setActiveMobileTab
}) {
    const [custSearch, setCustSearch] = useState('');
    const [showCustDropdown, setShowCustDropdown] = useState(false);

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()));
    const cartTotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const change = (parseInt(cashReceived) || 0) - cartTotal;

    return (
        <div className={`w-full lg:w-[380px] xl:w-[420px] bg-white border-l border-border shadow-2xl flex flex-col h-full z-30 ${activeMobileTab === 'cart' ? 'fixed inset-0' : 'hidden lg:flex'}`}>
            {/* Header */}
            <div className="p-5 border-b border-border bg-white flex justify-between items-center shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => setActiveMobileTab('products')} className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-primary rounded-full"><ArrowLeft className="w-6 h-6" /></button>
                    <div>
                        <h3 className="font-display font-bold text-text-primary text-xl flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /> Order</h3>
                        <p className="text-xs text-text-secondary mt-0.5 font-medium">{cart.length} items</p>
                    </div>
                </div>
                <button onClick={onClear} className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-lg flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f9fc] custom-scrollbar">
                <AnimatePresence>
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-50">
                            <ShoppingCart className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-sm font-bold">Keranjang Kosong</p>
                        </div>
                    ) : cart.map((item, idx) => (
                        <motion.div key={item.id + idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-white p-3 rounded-xl border border-border shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 mr-2">
                                    <div className="text-sm font-bold text-text-primary line-clamp-2">{item.name}</div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] font-mono bg-gray-50 px-1.5 rounded border border-gray-100">{item.sku}</span>
                                        <span className="text-[10px] bg-gray-50 px-1.5 rounded border border-gray-100">{item.spec}</span>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-primary font-mono">{formatRupiah(item.price * item.qty)}</div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-100">
                                <div className="text-[11px] text-text-secondary">@ {formatRupiah(item.price)}</div>
                                <div className="flex items-center bg-gray-50 rounded-lg border border-border h-8 overflow-hidden">
                                    <button onClick={() => onUpdateQty(idx, -1)} className="w-9 h-full flex items-center justify-center hover:bg-rose-100 text-rose-500 font-bold">-</button>
                                    <span className="text-sm font-bold w-8 text-center bg-white h-full flex items-center justify-center border-x border-border">{item.qty}</span>
                                    <button onClick={() => onUpdateQty(idx, 1)} className="w-9 h-full flex items-center justify-center hover:bg-blue-100 text-primary font-bold">+</button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-6 bg-white border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-40 space-y-5">
                {/* Inputs: Customer & Payment */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative z-20">
                        <div className="relative flex gap-2">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="w-4 h-4 text-text-secondary" /></div>
                            <input type="text" className="input-luxury py-2.5 pl-9 pr-8 text-xs" placeholder="Pelanggan..." value={selectedCustId ? (customers.find(c=>c.id===selectedCustId)?.name) : custSearch} onChange={(e) => { setCustSearch(e.target.value); setSelectedCustId(''); setShowCustDropdown(true); }} onFocus={() => setShowCustDropdown(true)} onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)} />
                            <button onClick={onOpenCustomerModal} className="shrink-0 bg-primary/10 text-primary rounded-xl w-10 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                            {selectedCustId && <button onClick={() => { setSelectedCustId(''); setCustSearch(''); }} className="absolute right-14 top-2.5 text-rose-500"><X className="w-3.5 h-3.5" /></button>}
                        </div>
                        {showCustDropdown && (
                            <div className="absolute bottom-full left-0 w-full max-h-48 overflow-y-auto bg-white border border-border rounded-t-xl shadow-xl mb-1 custom-scrollbar z-50">
                                <div className="p-3 text-xs hover:bg-gray-50 cursor-pointer border-b border-border flex gap-2" onClick={() => { setSelectedCustId(''); setCustSearch(''); setShowCustDropdown(false); }}><User className="w-3 h-3"/> <b>Tamu (Guest)</b></div>
                                {filteredCustomers.map(c => (<div key={c.id} className="p-3 text-xs hover:bg-gray-50 cursor-pointer border-b border-border" onClick={() => { setSelectedCustId(c.id); setCustSearch(c.name); setShowCustDropdown(false); }}><b>{c.name}</b> {c.phone && <span className="text-gray-400">({c.phone})</span>}</div>))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><CreditCard className="w-4 h-4 text-text-secondary" /></div>
                        <select className="input-luxury py-2.5 pl-9 text-xs appearance-none" value={paymentAccId} onChange={e=>setPaymentAccId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    </div>
                </div>
                
                {/* Totals */}
                <div className="bg-gray-50 p-3 rounded-xl border border-border flex flex-col gap-2">
                    <div className="flex justify-between items-end"><span className="text-xs font-bold text-text-secondary uppercase">Total</span><span className="text-2xl font-bold text-text-primary">{formatRupiah(cartTotal)}</span></div>
                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-border">
                        <span className="text-xs font-bold text-text-secondary ml-1">Bayar</span>
                        <NumericFormat className="text-right font-bold text-text-primary bg-transparent outline-none w-32 text-lg" placeholder="0" value={cashReceived} onValueChange={(v) => setCashReceived(v.floatValue || '')} prefix="Rp " thousandSeparator="." decimalSeparator="," />
                    </div>
                    {(cashReceived > 0 || change !== 0) && (
                        <div className="flex justify-between items-center px-2"><span className="text-[10px] font-bold text-text-secondary uppercase">Kembali</span><span className={`text-sm font-bold font-mono ${change < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{change < 0 ? `Kurang ${formatRupiah(Math.abs(change))}` : formatRupiah(change)}</span></div>
                    )}
                </div>

                <button onClick={onCheckout} className="w-full btn-gold py-4 text-sm shadow-lg flex items-center justify-center gap-2 group">
                    <span>PROSES BAYAR (F9)</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}