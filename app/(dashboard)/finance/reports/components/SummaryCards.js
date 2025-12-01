"use client";
import React from 'react';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';

export default function SummaryCards({ reportData, loading }) {
    const Card = ({ title, value, color, subValue }) => (
        <div className={`p-5 rounded-2xl border shadow-sm ${
            color === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 
            color === 'rose' ? 'bg-rose-50 border-rose-100 text-rose-800' : 
            'bg-white border-border text-text-primary'
        }`}>
            <p className="text-[10px] font-bold uppercase opacity-70 mb-2">{title}</p>
            <h3 className="text-2xl font-display font-bold">
                {loading ? <Skeleton className="h-8 w-32" /> : formatRupiah(value)}
            </h3>
            {subValue && <p className="text-xs mt-1 opacity-80">{subValue}</p>}
        </div>
    );

    const margin = reportData.revenue ? ((reportData.grossProfit / reportData.revenue) * 100).toFixed(1) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Total Pendapatan" value={reportData.revenue} color="default" />
            <Card 
                title="Gross Profit (Laba Kotor)" 
                value={reportData.grossProfit} 
                color="default" 
                subValue={`Margin: ${margin}%`} 
            />
            <Card 
                title="Net Profit (Laba Bersih)" 
                value={reportData.netProfit} 
                color={reportData.netProfit >= 0 ? 'emerald' : 'rose'} 
            />
        </div>
    );
}