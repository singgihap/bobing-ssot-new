"use client";
import React from 'react';
import { Phone, MapPin, Edit2, Trash2, ArrowDownLeft } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';

export default function CustomerCardList({ customers, debtMap, loading, onEdit, onDelete, onReceivePayment }) {
    return (
        <div className="md:hidden space-y-3">
            {loading ? <Skeleton className="h-32"/> : 
             customers.length === 0 ? <div className="text-center p-8 text-gray-400">Tidak ada data.</div> :
             customers.map(c => {
                const debt = debtMap[c.id] || 0;
                return (
                    <div key={c.id} className="bg-white p-4 rounded-xl border border-border shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm text-lg">
                                    {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-text-primary text-sm">{c.name}</h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                                        c.type === 'vip' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                        'bg-gray-100 text-gray-600 border-gray-200'
                                    }`}>
                                        {c.type?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            {debt > 0 && (
                                <div className="text-right">
                                    <span className="block text-[10px] text-text-secondary">Piutang</span>
                                    <span className="font-mono font-bold text-blue-600">{formatRupiah(debt)}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-2 text-xs text-text-secondary mb-4">
                            <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5" /> <span>{c.phone || '-'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span className="line-clamp-2">{c.address || '-'}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-dashed border-gray-200">
                            {debt > 0 && (
                                <button onClick={() => onReceivePayment(c)} className="flex-1 text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 py-2 rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-transform">
                                    <ArrowDownLeft className="w-3.5 h-3.5"/> Terima Bayar
                                </button>
                            )}
                            <button onClick={() => onEdit(c)} className="p-2 bg-gray-50 border border-border rounded-lg text-text-secondary hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => onDelete(c.id)} className="p-2 bg-gray-50 border border-border rounded-lg text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                )
            })}
        </div>
    );
}