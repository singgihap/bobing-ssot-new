"use client";
import React, { useState } from 'react';
import { formatRupiah } from '@/lib/utils';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton from '@/components/Skeleton';

// HAPUS 'default', GANTI JADI: export function
export function IncomeStatementMobile({ reportData, details, loading }) {
    if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    const Section = ({ title, total, items, icon: Icon, color, isNegative = false }) => {
        const [isOpen, setIsOpen] = useState(false);
        return (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-3">
                <div onClick={() => setIsOpen(!isOpen)} className="p-4 flex justify-between items-center bg-gray-50/50 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${color} bg-opacity-10 text-opacity-100`}>
                            <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
                        </div>
                        <span className="text-sm font-bold text-text-primary">{title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isNegative && total > 0 ? '-' : ''}{formatRupiah(total || 0)}
                        </span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-text-secondary"/> : <ChevronDown className="w-4 h-4 text-text-secondary"/>}
                    </div>
                </div>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="border-t border-border">
                            {!items || Object.entries(items).length === 0 ? (
                                <div className="p-4 text-xs text-center text-text-secondary italic">Tidak ada data.</div>
                            ) : (
                                <ul className="divide-y divide-border/50">
                                    {Object.entries(items).map(([k, v]) => (
                                        <li key={k} className="flex justify-between p-3 text-xs">
                                            <span className="text-text-secondary">{k}</span>
                                            <span className="font-mono text-text-primary">
                                                {isNegative ? '-' : ''}{formatRupiah(v)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="md:hidden space-y-4">
            <Section title="Pendapatan" total={reportData?.revenue} items={details?.revenue} icon={DollarSign} color="bg-emerald-500" />
            <Section title="HPP (Modal)" total={reportData?.cogs} items={details?.cogs} icon={TrendingDown} color="bg-rose-500" isNegative />
            <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex justify-between items-center">
                <span className="text-xs font-bold text-blue-800 uppercase">Laba Kotor</span>
                <span className="text-lg font-bold text-blue-700">{formatRupiah(reportData?.grossProfit || 0)}</span>
            </div>
            <Section title="Beban Operasional" total={reportData?.expenses} items={details?.expense} icon={TrendingDown} color="bg-amber-500" isNegative />
            <div className={`p-5 rounded-xl border flex justify-between items-center shadow-md ${(reportData?.netProfit || 0) >= 0 ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-rose-600 border-rose-700 text-white'}`}>
                <div>
                    <p className="text-xs font-medium opacity-90 uppercase tracking-wider">Laba Bersih</p>
                    <h3 className="text-2xl font-bold font-display mt-1">{formatRupiah(reportData?.netProfit || 0)}</h3>
                </div>
                <div className="bg-white/20 p-2 rounded-full"><TrendingUp className="w-6 h-6 text-white"/></div>
            </div>
        </div>
    );
}