// app/(dashboard)/finance/reports/page.js
"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import { 
    TrendingUp, Filter, ArrowRight 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProfitLossPage() {
    const [loading, setLoading] = useState(false);
    
    // Date Filter (Default: Awal Bulan s/d Hari Ini)
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0]
    });

    // Data State
    const [reportData, setReportData] = useState({
        revenue: 0, cogs: 0, expenses: 0, 
        grossProfit: 0, netProfit: 0
    });

    const [details, setDetails] = useState({ revenue: {}, cogs: {}, expense: {} });

    useEffect(() => {
        fetchProfitLoss();
    }, [dateRange]);

    const fetchProfitLoss = async () => {
        setLoading(true);
        try {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59);

            // Fetch transaksi dalam periode
            const q = query(
                collection(db, "cash_transactions"),
                where("date", ">=", start),
                where("date", "<=", end)
            );
            
            const snap = await getDocs(q);
            
            // Fetch Master Akun untuk mapping nama/kode
            const accSnap = await getDocs(collection(db, "chart_of_accounts"));
            const accMap = {}; 
            accSnap.forEach(d => { accMap[d.id] = d.data(); });

            let revenue = 0;
            let cogs = 0;
            let expenses = 0;
            const breakdown = { revenue: {}, cogs: {}, expense: {} };

            const addBreakdown = (name, amount, type) => {
                if(!breakdown[type][name]) breakdown[type][name] = 0;
                breakdown[type][name] += amount;
            };

            snap.forEach(doc => {
                const t = doc.data();
                
                // [FIXED] Gunakan 'account_id' langsung (Logic Jurnal Murni)
                if (t.account_id && accMap[t.account_id]) {
                    const acc = accMap[t.account_id];
                    const code = String(acc.code);
                    
                    // Ambil nilai Debit/Kredit
                    // Fallback ke t.amount jika field debit/credit belum ada (data lama)
                    const debit = t.debit || (t.type === 'in' ? t.amount : 0) || 0;
                    const credit = t.credit || (t.type === 'out' ? t.amount : 0) || 0;

                    // 1. PENDAPATAN (Kepala 4)
                    // Normal Balance: Kredit (+)
                    if (code.startsWith('4')) {
                        const netAmount = credit - debit; // Kredit menambah, Debit mengurangi (Retur)
                        if (netAmount !== 0) {
                            revenue += netAmount;
                            addBreakdown(acc.name, netAmount, 'revenue');
                        }
                    }

                    // 2. HPP (Kepala 5 + Nama mengandung 'HPP')
                    // Normal Balance: Debit (+)
                    else if (code.startsWith('5') && acc.name.toLowerCase().includes('hpp')) {
                        const netAmount = debit - credit; // Debit menambah, Kredit mengurangi
                        if (netAmount !== 0) {
                            cogs += netAmount;
                            addBreakdown(acc.name, netAmount, 'cogs');
                        }
                    }

                    // 3. BEBAN OPERASIONAL (Kepala 5 Lainnya)
                    // Normal Balance: Debit (+)
                    else if (code.startsWith('5') && !acc.name.toLowerCase().includes('hpp')) {
                        const netAmount = debit - credit;
                        if (netAmount !== 0) {
                            expenses += netAmount;
                            addBreakdown(acc.name, netAmount, 'expense');
                        }
                    }
                }
            });

            setReportData({
                revenue, cogs, expenses,
                grossProfit: revenue - cogs,
                netProfit: revenue - cogs - expenses
            });
            setDetails(breakdown);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const SummaryCard = ({ title, value, color, subValue }) => (
        <div className={`p-5 rounded-2xl border ${color === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : color === 'rose' ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-white border-border text-text-primary'}`}>
            <p className="text-xs font-bold uppercase opacity-70 mb-2">{title}</p>
            <h3 className="text-2xl font-display font-bold">{formatRupiah(value)}</h3>
            {subValue && <p className="text-xs mt-1 opacity-80">{subValue}</p>}
        </div>
    );

    const ReportRow = ({ name, value, indent=false, bold=false }) => (
        <div className={`flex justify-between items-center py-3 border-b border-border/50 hover:bg-gray-50 transition-colors ${indent ? 'pl-8 text-sm' : 'font-bold text-sm'} ${bold ? 'bg-gray-50/80' : ''}`}>
            <span className={indent ? 'text-text-secondary' : 'text-text-primary'}>{name}</span>
            <span className={`font-mono ${value < 0 ? 'text-rose-600' : ''}`}>{formatRupiah(value)}</span>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 fade-in pb-20">
            <PageHeader 
                title="Laporan Laba Rugi" 
                subtitle="Analisa pendapatan, HPP, dan beban operasional." 
            />

            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="space-y-6">
                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-2xl border border-border shadow-sm flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-text-secondary">
                        <Filter className="w-4 h-4"/> Periode:
                    </div>
                    <input type="date" className="input-luxury w-auto py-2 text-xs" value={dateRange.start} onChange={e=>setDateRange({...dateRange, start:e.target.value})} />
                    <ArrowRight className="w-4 h-4 text-gray-300"/>
                    <input type="date" className="input-luxury w-auto py-2 text-xs" value={dateRange.end} onChange={e=>setDateRange({...dateRange, end:e.target.value})} />
                    <button onClick={fetchProfitLoss} className="btn-primary py-2 px-4 text-xs shadow-sm ml-auto flex items-center gap-2">
                        {loading ? 'Loading...' : 'Terapkan Filter'}
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard title="Total Pendapatan" value={reportData.revenue} color="default" />
                    <SummaryCard title="Gross Profit (Laba Kotor)" value={reportData.grossProfit} color="default" subValue={`Margin: ${reportData.revenue ? ((reportData.grossProfit/reportData.revenue)*100).toFixed(1) : 0}%`} />
                    <SummaryCard title="Net Profit (Laba Bersih)" value={reportData.netProfit} color={reportData.netProfit >= 0 ? 'emerald' : 'rose'} />
                </div>

                {/* Detail Table */}
                <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden p-6">
                    <h3 className="text-lg font-bold font-display mb-4 text-center border-b border-border pb-4">
                        Income Statement
                        <span className="block text-xs font-sans font-normal text-text-secondary mt-1">
                            {new Date(dateRange.start).toLocaleDateString()} s/d {new Date(dateRange.end).toLocaleDateString()}
                        </span>
                    </h3>

                    <div className="space-y-1">
                        {/* REVENUE */}
                        <ReportRow name="PENDAPATAN USAHA" value={reportData.revenue} bold />
                        {details.revenue && Object.entries(details.revenue).map(([k,v]) => (
                            <ReportRow key={k} name={k} value={v} indent />
                        ))}

                        {/* COGS */}
                        <div className="h-4"></div>
                        <ReportRow name="HARGA POKOK PENJUALAN (HPP)" value={-reportData.cogs} bold />
                        {details.cogs && Object.entries(details.cogs).map(([k,v]) => (
                            <ReportRow key={k} name={`(${k})`} value={-v} indent />
                        ))}

                        {/* GROSS PROFIT */}
                        <div className="my-4 pt-4 border-t-2 border-dashed border-gray-200">
                            <ReportRow name="LABA KOTOR" value={reportData.grossProfit} bold />
                        </div>

                        {/* EXPENSES */}
                        <div className="h-4"></div>
                        <ReportRow name="BEBAN OPERASIONAL" value={-reportData.expenses} bold />
                        {details.expense && Object.entries(details.expense).map(([k,v]) => (
                            <ReportRow key={k} name={`(${k})`} value={-v} indent />
                        ))}

                        {/* NET PROFIT */}
                        <div className="mt-6 pt-4 border-t-4 border-double border-gray-200">
                            <div className={`flex justify-between items-center py-4 px-4 rounded-xl font-bold text-lg ${reportData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                                <span>LABA / (RUGI) BERSIH</span>
                                <span>{formatRupiah(reportData.netProfit)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}