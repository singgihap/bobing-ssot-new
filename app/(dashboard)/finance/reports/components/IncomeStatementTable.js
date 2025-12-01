"use client";
import React from 'react';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';

// HAPUS 'default', GANTI JADI: export function
export function IncomeStatementTable({ reportData, details, loading, dateRange }) {
    if (loading) return <Skeleton className="h-96 w-full rounded-2xl" />;

    const Row = ({ name, value, indent = false, bold = false, isNegative = false }) => (
        <div className={`flex justify-between items-center py-3 border-b border-border/50 hover:bg-gray-50 transition-colors ${indent ? 'pl-8 text-sm' : 'font-bold text-sm'} ${bold ? 'bg-gray-50/80' : ''}`}>
            <span className={indent ? 'text-text-secondary' : 'text-text-primary'}>{name}</span>
            <span className={`font-mono ${value < 0 || isNegative ? 'text-rose-600' : 'text-text-primary'}`}>
                {isNegative && value > 0 ? `(${formatRupiah(value)})` : formatRupiah(value)}
            </span>
        </div>
    );

    return (
        <div className="hidden md:block bg-white border border-border rounded-2xl shadow-sm overflow-hidden p-6">
            <h3 className="text-lg font-bold font-display mb-4 text-center border-b border-border pb-4">
                Income Statement
                <span className="block text-xs font-sans font-normal text-text-secondary mt-1">
                    {dateRange?.start && dateRange?.end 
                        ? `${new Date(dateRange.start).toLocaleDateString()} s/d ${new Date(dateRange.end).toLocaleDateString()}`
                        : '-'}
                </span>
            </h3>

            <div className="space-y-1">
                <Row name="PENDAPATAN USAHA" value={reportData?.revenue || 0} bold />
                {details?.revenue && Object.entries(details.revenue).map(([k,v]) => <Row key={k} name={k} value={v} indent />)}

                <div className="h-4"></div>
                <Row name="HARGA POKOK PENJUALAN (HPP)" value={reportData?.cogs || 0} bold isNegative />
                {details?.cogs && Object.entries(details.cogs).map(([k,v]) => <Row key={k} name={k} value={v} indent isNegative />)}

                <div className="my-4 pt-4 border-t-2 border-dashed border-gray-200">
                    <Row name="LABA KOTOR" value={reportData?.grossProfit || 0} bold />
                </div>

                <div className="h-4"></div>
                <Row name="BEBAN OPERASIONAL" value={reportData?.expenses || 0} bold isNegative />
                {details?.expense && Object.entries(details.expense).map(([k,v]) => <Row key={k} name={k} value={v} indent isNegative />)}

                <div className="mt-6 pt-4 border-t-4 border-double border-gray-200">
                    <div className={`flex justify-between items-center py-4 px-4 rounded-xl font-bold text-lg ${(reportData?.netProfit || 0) >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                        <span>LABA / (RUGI) BERSIH</span>
                        <span>{formatRupiah(reportData?.netProfit || 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}