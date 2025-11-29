// components/finance/CashTransactionsTable.js
"use client";
import React from 'react';
import { formatRupiah } from '@/lib/utils';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';

// HELPER: Status Badge Modern
const getStatusBadge = (type) => {
    switch (type) {
        case 'IN': 
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide">
                    <ArrowDownLeft className="w-3 h-3" /> Masuk
                </span>
            );
        case 'OUT': 
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wide">
                    <ArrowUpRight className="w-3 h-3" /> Keluar
                </span>
            );
        case 'TRANSFER': 
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
                    <ArrowRightLeft className="w-3 h-3" /> Transfer
                </span>
            );
        default:
            return <span className="badge-luxury badge-neutral">{type}</span>;
    }
}

const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    try {
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '-';
    }
};

const formatAmount = (amount, type) => {
    const isOut = type === 'OUT';
    return (
        <span className={`font-mono font-bold ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isOut ? '-' : '+'} {formatRupiah(amount)}
        </span>
    );
}

export default function CashTransactionsTable({ transactions, loading, fetchData }) {
    return (
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            {/* Header Table */}
            <div className="px-6 py-4 border-b border-border bg-white flex justify-between items-center">
                <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    Recent Transactions
                </h3>
                <button 
                    onClick={fetchData} 
                    className="text-[10px] font-bold text-text-secondary hover:text-primary flex items-center gap-1 bg-gray-50 hover:bg-white border border-border px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
                >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>
            
            {/* Table Content */}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                        <tr>
                            <th className="px-6 py-3">Date/Time</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Account</th>
                            <th className="px-6 py-3">Description</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                            <th className="px-6 py-3 text-right">Balance After</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-border/60 text-text-primary">
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-12 text-text-secondary animate-pulse">Memuat data transaksi...</td></tr>
                        ) : transactions.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-12 text-text-secondary italic">Belum ada transaksi tercatat.</td></tr>
                        ) : (
                            transactions.map((t) => (
                                <tr key={t.id} className="group hover:bg-gray-50/80 transition-colors">
                                    <td className="px-6 py-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                                        {formatDate(t.date)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(t.type)}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-text-primary">
                                        {t.account_id}
                                    </td>
                                    <td className="px-6 py-4 text-text-secondary text-xs max-w-[200px] truncate" title={t.description}>
                                        {t.description}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {formatAmount(t.amount, t.type)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-text-primary group-hover:text-primary transition-colors">
                                        {formatRupiah(t.balance_after)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}