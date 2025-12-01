"use client";
import React from 'react';
import { CheckCircle, Clock, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';

export default function PurchaseTable({ history, loading, onEdit, onDelete }) {
    const StatusBadge = ({ status }) => {
        const isPaid = status === 'paid';
        return (
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                {isPaid ? <CheckCircle className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                {status}
            </span>
        );
    };

    return (
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/80 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                        <tr>
                            <th className="pl-6 py-4">Date</th>
                            <th className="py-4">Supplier & ID</th>
                            <th className="py-4 text-right">Total</th>
                            <th className="py-4 text-center">Payment</th>
                            <th className="py-4 text-right pr-6">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border/60">
                        {loading ? <tr><td colSpan="5" className="p-8 text-center text-text-secondary animate-pulse">Loading...</td></tr> : 
                         history.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-text-secondary">Belum ada pembelian.</td></tr> :
                         history.map(h => (
                            <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                                <td className="pl-6 py-4 font-mono text-xs text-text-secondary">
                                    {new Date(h.order_date).toLocaleDateString()}
                                </td>
                                <td className="py-4">
                                    <div className="font-medium text-text-primary">{h.supplier_name}</div>
                                    <Link href={`/purchases/${h.id}`} className="text-[10px] text-primary hover:underline font-mono flex items-center gap-1">
                                        #{h.id.substring(0,8)} <ExternalLink className="w-3 h-3"/>
                                    </Link>
                                </td>
                                <td className="py-4 text-right font-bold text-primary">{formatRupiah(h.total_amount)}</td>
                                <td className="py-4 text-center flex justify-center"><StatusBadge status={h.payment_status} /></td>
                                <td className="py-4 text-right pr-6">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => onEdit(h)} className="p-1.5 text-text-secondary hover:text-primary hover:bg-blue-50 rounded-lg transition-colors" title="Edit PO"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(h)} className="p-1.5 text-text-secondary hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus PO"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}