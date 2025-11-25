// components/finance/CashTransactionsTable.js
"use client";
import React from 'react';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton'; 

// FUNGSI BANTUAN UNTUK STATUS BADGE
const getStatusBadge = (type) => {
    switch (type) {
        case 'IN': // Pemasukan
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'OUT': // Pengeluaran
            return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'TRANSFER': // Transfer
            return 'bg-blue-100 text-blue-700 border-blue-200';
        default:
            return 'bg-gray-100 text-gray-700 border-gray-200';
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
    const sign = type === 'OUT' ? '-' : '+';
    const colorClass = type === 'OUT' ? 'text-rose-600' : 'text-emerald-600';
    return <span className={colorClass}>{sign} {formatRupiah(amount)}</span>;
}

export default function CashTransactionsTable({ transactions, loading, fetchData }) {
    return (
        <div className="card-luxury overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider">Recent Transactions</h3>
                {/* btn-ghost-dark sudah di refactor */}
                <button onClick={fetchData} className="btn-ghost-dark text-xs">↻ Refresh</button>
            </div>
            
            <div className="table-wrapper-dark border-none shadow-none rounded-none overflow-x-auto">
                <table className="table-dark w-full min-w-full text-xs">
                    <thead>
                        <tr>
                            <th>Date/Time</th>
                            <th>Type</th>
                            <th>Account</th>
                            <th>Description</th>
                            <th className="text-right">Amount</th>
                            <th className="text-right">Balance After</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-8 text-text-secondary"><Skeleton className="h-6 w-1/2 mx-auto" /></td></tr>
                        ) : transactions.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-text-secondary">No recent cash transactions found.</td></tr>
                        ) : (
                            transactions.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="font-mono text-[11px] text-text-secondary">{formatDate(t.date)}</td>
                                    <td>
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadge(t.type)}`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="text-text-primary font-medium">{t.account_id}</td>
                                    <td className="text-text-secondary text-sm truncate max-w-[200px]">{t.description}</td>
                                    <td className="text-right font-mono font-bold">
                                        {formatAmount(t.amount, t.type)}
                                    </td>
                                    {/* text-primary (Biru Vibrant) untuk balance utama */}
                                    <td className="text-right font-mono text-primary font-bold">
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