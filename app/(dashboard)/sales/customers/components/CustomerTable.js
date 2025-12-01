"use client";
import React from 'react';
import { Phone, MapPin, Edit2, Trash2, ArrowDownLeft } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

export default function CustomerTable({ customers, debtMap, loading, onEdit, onDelete, onReceivePayment }) {
    return (
        <div className="hidden md:block bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/80 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                        <tr>
                            <th className="pl-6 py-4 w-1/3">Name & Type</th>
                            <th className="py-4">Contact Info</th>
                            <th className="py-4">Location</th>
                            <th className="py-4 text-right">Piutang</th>
                            <th className="text-right pr-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border/60">
                        {loading ? (
                            <tr><td colSpan="5" className="text-center py-20 text-text-secondary animate-pulse">Loading Customers...</td></tr>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan="5" className="text-center py-20 text-text-secondary">Tidak ada data ditemukan.</td></tr>
                        ) : (
                            customers.map(c => {
                                const debt = debtMap[c.id] || 0;
                                return (
                                    <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="pl-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-text-primary text-sm">{c.name}</div>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide border ${
                                                        c.type === 'vip' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        c.type === 'reseller' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                                        'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                        {c.type?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                                                <Phone className="w-3.5 h-3.5" />
                                                <span className="font-mono">{c.phone || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-start gap-2 text-sm text-text-secondary max-w-xs">
                                                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                <span className="truncate">{c.address || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-right font-mono font-bold text-blue-600">
                                            {debt > 0 ? formatRupiah(debt) : '-'}
                                        </td>
                                        <td className="pr-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {debt > 0 && (
                                                    <button onClick={() => onReceivePayment(c)} className="text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm flex items-center gap-1">
                                                        <ArrowDownLeft className="w-3 h-3"/> Terima
                                                    </button>
                                                )}
                                                <button onClick={() => onEdit(c)} className="p-2 bg-white border border-border rounded-lg text-text-secondary hover:text-primary hover:border-primary shadow-sm transition-all">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => onDelete(c.id)} className="p-2 bg-white border border-border rounded-lg text-rose-400 hover:text-rose-600 hover:border-rose-200 shadow-sm transition-all">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}