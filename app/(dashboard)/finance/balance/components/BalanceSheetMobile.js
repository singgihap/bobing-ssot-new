"use client";
import React, { useState } from 'react';
import { formatRupiah } from '@/lib/utils';
import { ChevronDown, ChevronUp, PieChart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton from '@/components/Skeleton';

export default function BalanceSheetMobile({ reportData, details, loading }) {
    if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    const Section = ({ title, total, items, color }) => {
        const [isOpen, setIsOpen] = useState(false);
        return (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-3">
                <div onClick={() => setIsOpen(!isOpen)} className="p-4 flex justify-between items-center bg-gray-50/50 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${color} bg-opacity-10 text-opacity-100`}>
                            <PieChart className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
                        </div>
                        <span className="text-sm font-bold text-text-primary">{title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-text-primary">
                            {formatRupiah(total)}
                        </span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-text-secondary"/> : <ChevronDown className="w-4 h-4 text-text-secondary"/>}
                    </div>
                </div>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="border-t border-border bg-white">
                            {Object.entries(items).length === 0 ? (
                                <div className="p-4 text-xs text-center text-text-secondary italic">Tidak ada data.</div>
                            ) : (
                                <ul className="divide-y divide-border/50">
                                    {Object.entries(items).map(([k, v]) => (
                                        <li key={k} className="flex justify-between p-3 text-xs">
                                            <span className="text-text-secondary">{k}</span>
                                            <span className="font-mono text-text-primary font-medium">{formatRupiah(v)}</span>
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
            <Section 
                title="Aset (Aktiva)" 
                total={reportData.assets} 
                items={details.assets} 
                color="bg-emerald-500" 
            />
            <Section 
                title="Kewajiban (Hutang)" 
                total={reportData.liabilities} 
                items={details.liabilities} 
                color="bg-rose-500" 
            />
            <Section 
                title="Ekuitas (Modal)" 
                total={reportData.equity} 
                items={details.equity} 
                color="bg-blue-500" 
            />
            
            <div className="p-4 bg-gray-800 text-white rounded-xl flex justify-between items-center shadow-lg mt-4">
                <span className="text-xs font-bold uppercase tracking-wider">Total Pasiva</span>
                <span className="text-lg font-bold font-mono">{formatRupiah(reportData.liabilities + reportData.equity)}</span>
            </div>
        </div>
    );
}