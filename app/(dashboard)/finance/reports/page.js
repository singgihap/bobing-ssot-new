"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import PageHeader from '@/components/PageHeader';
import { Filter, ArrowRight, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

// UPDATE IMPORT DI SINI (Gunakan kurung kurawal)
import SummaryCards from './components/SummaryCards'; // Ini biarkan default jika SummaryCards masih export default
import { IncomeStatementTable } from './components/IncomeStatementTable'; // Named Import
import { IncomeStatementMobile } from './components/IncomeStatementMobile'; // Named Import

import { getCache, setCache, CACHE_KEYS, DURATION } from '@/lib/cacheManager';

export default function ProfitLossPage() {
    // ... (SISA KODE SAMA PERSIS DENGAN SEBELUMNYA) ...
    // Pastikan logic fetchProfitLoss dan return JSX di bawah tetap ada.
    
    // Copy-paste ulang seluruh fungsi ProfitLossPage dari jawaban sebelumnya jika ragu,
    // TAPI pastikan bagian import di atas diganti seperti ini.
    
    const [loading, setLoading] = useState(false);
    
    // Filter Date
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0]
    });

    const [reportData, setReportData] = useState({ revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 });
    const [details, setDetails] = useState({ revenue: {}, cogs: {}, expense: {} });

    useEffect(() => {
        fetchProfitLoss();
    }, [dateRange]);

    const fetchProfitLoss = async () => {
        setLoading(true);
        try {
            const cacheKey = `${CACHE_KEYS.SALES_HISTORY}_PL_${dateRange.start}_${dateRange.end}`;
            const cached = getCache(cacheKey, DURATION.SHORT);
            if (cached) {
                setReportData(cached.reportData);
                setDetails(cached.details);
                setLoading(false);
                return;
            }

            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59);

            const q = query(collection(db, "cash_transactions"), where("date", ">=", start), where("date", "<=", end));
            const snap = await getDocs(q);
            const accSnap = await getDocs(collection(db, "chart_of_accounts"));
            const accMap = {}; 
            accSnap.forEach(d => { accMap[d.id] = d.data(); });

            let revenue = 0, cogs = 0, expenses = 0;
            const breakdown = { revenue: {}, cogs: {}, expense: {} };

            const addBreakdown = (name, amount, type) => {
                if(!breakdown[type][name]) breakdown[type][name] = 0;
                breakdown[type][name] += amount;
            };

            snap.forEach(doc => {
                const t = doc.data();
                if (t.account_id && accMap[t.account_id]) {
                    const acc = accMap[t.account_id];
                    const code = String(acc.code);
                    const debit = t.debit || (t.type === 'in' ? t.amount : 0) || 0;
                    const credit = t.credit || (t.type === 'out' ? t.amount : 0) || 0;

                    if (code.startsWith('4')) {
                        const net = credit - debit;
                        if (net !== 0) { revenue += net; addBreakdown(acc.name, net, 'revenue'); }
                    }
                    else if (code.startsWith('5') && acc.name.toLowerCase().includes('hpp')) {
                        const net = debit - credit;
                        if (net !== 0) { cogs += net; addBreakdown(acc.name, net, 'cogs'); }
                    }
                    else if (code.startsWith('5') || code.startsWith('6')) {
                        const net = debit - credit;
                        if (net !== 0) { expenses += net; addBreakdown(acc.name, net, 'expense'); }
                    }
                }
            });

            const data = { revenue, cogs, expenses, grossProfit: revenue - cogs, netProfit: revenue - cogs - expenses };
            setReportData(data);
            setDetails(breakdown);
            setCache(cacheKey, { reportData: data, details: breakdown });

        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 fade-in pb-20 text-text-primary">
            <PageHeader title="Laporan Laba Rugi" subtitle="Analisa pendapatan, HPP, dan beban operasional." actions={
                <button onClick={fetchProfitLoss} className="btn-ghost-dark text-xs flex items-center gap-2"><RotateCcw className="w-4 h-4"/> Refresh</button>
            }/>

            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-text-secondary w-full sm:w-auto"><Filter className="w-4 h-4"/> Periode:</div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input type="date" className="input-luxury py-2 text-xs" value={dateRange.start} onChange={e=>setDateRange({...dateRange, start:e.target.value})} />
                        <ArrowRight className="w-4 h-4 text-gray-300 shrink-0"/>
                        <input type="date" className="input-luxury py-2 text-xs" value={dateRange.end} onChange={e=>setDateRange({...dateRange, end:e.target.value})} />
                    </div>
                    <button onClick={fetchProfitLoss} className="btn-primary py-2 px-4 text-xs shadow-sm w-full sm:w-auto ml-auto">Terapkan</button>
                </div>

                <SummaryCards reportData={reportData} loading={loading} />
                
                {/* Responsive Views */}
                <IncomeStatementTable reportData={reportData} details={details} loading={loading} dateRange={dateRange} />
                <IncomeStatementMobile reportData={reportData} details={details} loading={loading} />
            </motion.div>
        </div>
    );
}