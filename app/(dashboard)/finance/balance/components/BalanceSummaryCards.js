"use client";
import React from 'react';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';
import { PieChart, AlertTriangle, CheckCircle } from 'lucide-react';

export default function BalanceSummaryCards({ reportData, loading }) {
    const isBalanced = Math.abs(reportData.assets - (reportData.liabilities + reportData.equity)) <= 1000; // Toleransi 1000 rupiah

    const Card = ({ title, value, color, icon: Icon }) => (
        <div className={`p-5 rounded-2xl border shadow-sm flex justify-between items-start ${
            color === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-800' :
            color === 'rose' ? 'bg-rose-50 border-rose-100 text-rose-800' :
            'bg-white border-border text-text-primary'
        }`}>
            <div>
                <p className="text-[10px] font-bold uppercase opacity-70 mb-2">{title}</p>
                <h3 className="text-2xl font-display font-bold">
                    {loading ? <Skeleton className="h-8 w-32" /> : formatRupiah(value)}
                </h3>
            </div>
            {Icon && <div className={`p-2 rounded-lg bg-white/50`}><Icon className="w-5 h-5"/></div>}
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Balance Indicator */}
            {!loading && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${isBalanced ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800 animate-pulse'}`}>
                    {isBalanced ? <CheckCircle className="w-6 h-6"/> : <AlertTriangle className="w-6 h-6"/>}
                    <div>
                        <h4 className="font-bold text-sm">{isBalanced ? "Neraca Seimbang (Balanced)" : "Neraca Tidak Seimbang!"}</h4>
                        <p className="text-xs opacity-90">
                            {isBalanced 
                                ? "Persamaan Akuntansi: Aset = Kewajiban + Ekuitas terpenuhi."
                                : `Selisih: ${formatRupiah(reportData.assets - (reportData.liabilities + reportData.equity))}. Cek jurnal manual Anda.`
                            }
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="Total Aset" value={reportData.assets} color="default" icon={PieChart} />
                <Card title="Total Kewajiban" value={reportData.liabilities} color="rose" icon={PieChart} />
                <Card title="Total Ekuitas (Modal)" value={reportData.equity} color="blue" icon={PieChart} />
            </div>
        </div>
    );
}