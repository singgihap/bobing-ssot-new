"use client";
import React from 'react';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';
import { PieChart } from 'lucide-react';

export default function BalanceSheetTable({ reportData, details, loading }) {
    if (loading) return <Skeleton className="h-96 w-full rounded-2xl" />;

    const ReportRow = ({ name, value, indent=false, bold=false }) => (
        <div className={`flex justify-between items-center py-2 border-b border-border/50 hover:bg-gray-50 transition-colors ${indent ? 'pl-6 text-xs' : 'font-bold text-sm'} ${bold ? 'bg-gray-50/80' : ''}`}>
            <span className={indent ? 'text-text-secondary' : 'text-text-primary'}>{name}</span>
            <span className={`font-mono ${value < 0 ? 'text-rose-600' : 'text-text-primary'}`}>{formatRupiah(value)}</span>
        </div>
    );

    return (
        <div className="hidden md:grid grid-cols-2 gap-6">
            {/* KOLOM KIRI: ASET */}
            <div className="bg-white border border-border rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold font-display mb-4 text-emerald-700 border-b border-border pb-2 flex items-center gap-2">
                    <PieChart className="w-5 h-5"/> ASET (ACTIVA)
                </h3>
                <div className="space-y-1">
                    {details.assets && Object.entries(details.assets).map(([k,v]) => (
                        <ReportRow key={k} name={k} value={v} indent />
                    ))}
                    {Object.keys(details.assets).length === 0 && <p className="text-center text-gray-400 py-4 italic text-xs">Belum ada data aset.</p>}
                    
                    <div className="mt-8 pt-4 border-t-2 border-gray-800">
                        <ReportRow name="TOTAL ASET" value={reportData.assets} bold />
                    </div>
                </div>
            </div>

            {/* KOLOM KANAN: KEWAJIBAN & EKUITAS */}
            <div className="bg-white border border-border rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold font-display mb-4 text-blue-700 border-b border-border pb-2 flex items-center gap-2">
                    <PieChart className="w-5 h-5"/> PASIVA
                </h3>
                
                {/* Liabilities */}
                <div className="space-y-1 mb-8">
                    <p className="text-xs font-bold text-text-secondary uppercase mb-2 bg-gray-50 p-1 rounded">Kewajiban (Liabilities)</p>
                    {details.liabilities && Object.entries(details.liabilities).map(([k,v]) => (
                        <ReportRow key={k} name={k} value={v} indent />
                    ))}
                    <div className="pt-2 border-t border-dashed border-gray-200">
                        <ReportRow name="Total Kewajiban" value={reportData.liabilities} bold />
                    </div>
                </div>

                {/* Equity */}
                <div className="space-y-1">
                    <p className="text-xs font-bold text-text-secondary uppercase mb-2 bg-gray-50 p-1 rounded">Ekuitas (Equity)</p>
                    {details.equity && Object.entries(details.equity).map(([k,v]) => (
                        <ReportRow key={k} name={k} value={v} indent />
                    ))}
                    <div className="pt-2 border-t border-dashed border-gray-200">
                        <ReportRow name="Total Ekuitas" value={reportData.equity} bold />
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t-2 border-gray-800">
                    <ReportRow name="TOTAL PASIVA" value={reportData.liabilities + reportData.equity} bold />
                </div>
            </div>
        </div>
    );
}