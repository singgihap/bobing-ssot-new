"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import PageHeader from '@/components/PageHeader';
import { RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

// COMPONENTS
import BalanceSummaryCards from './components/BalanceSummaryCards';
import BalanceSheetTable from './components/BalanceSheetTable';
import BalanceSheetMobile from './components/BalanceSheetMobile';

// CACHE
import { getCache, setCache, CACHE_KEYS, DURATION } from '@/lib/cacheManager';

export default function BalanceSheetPage() {
    const [loading, setLoading] = useState(false);
    
    // Data State
    const [reportData, setReportData] = useState({ assets: 0, liabilities: 0, equity: 0 });
    const [details, setDetails] = useState({ assets: {}, liabilities: {}, equity: {} });

    useEffect(() => {
        fetchBalanceSheet();
    }, []);

    const fetchBalanceSheet = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache (Short Duration karena saldo sering berubah)
            if (!forceRefresh) {
                const cached = getCache(CACHE_KEYS.BALANCE_SHEET, DURATION.SHORT); // 5 Menit
                if (cached) {
                    setReportData(cached.reportData);
                    setDetails(cached.details);
                    setLoading(false);
                    return;
                }
            }

            // 2. Fetch Firebase
            const q = query(collection(db, "chart_of_accounts"), orderBy("code"));
            const snap = await getDocs(q);
            
            let assets = 0;
            let liabilities = 0;
            let equity = 0;
            
            const breakdown = { assets: {}, liabilities: {}, equity: {} };
            
            let totalRevenueAllTime = 0;
            let totalExpenseAllTime = 0;

            snap.forEach(doc => {
                const acc = doc.data();
                const code = String(acc.code);
                const bal = parseFloat(acc.balance) || 0;

                // Mapping Akun Neraca
                if (code.startsWith('1')) { // ASSET
                    assets += bal;
                    breakdown.assets[acc.name] = bal;
                } else if (code.startsWith('2')) { // LIABILITY
                    liabilities += bal;
                    breakdown.liabilities[acc.name] = bal;
                } else if (code.startsWith('3')) { // EQUITY
                    equity += bal;
                    breakdown.equity[acc.name] = bal;
                } 
                // Akun Laba Rugi (untuk perhitungan Laba Ditahan/Berjalan)
                else if (code.startsWith('4')) { // REVENUE
                    totalRevenueAllTime += bal;
                } else if (code.startsWith('5') || code.startsWith('6')) { // EXPENSE
                    totalExpenseAllTime += bal;
                }
            });

            // Hitung Laba Tahun Berjalan (Implied)
            const calculatedEarnings = totalRevenueAllTime - totalExpenseAllTime;
            
            // Masukkan ke Ekuitas
            breakdown.equity['Laba Periode Berjalan (Current Earnings)'] = calculatedEarnings;
            equity += calculatedEarnings;

            const data = { assets, liabilities, equity };

            setReportData(data);
            setDetails(breakdown);
            
            // 3. Simpan Cache
            setCache(CACHE_KEYS.BALANCE_SHEET, { reportData: data, details: breakdown });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 fade-in pb-20 text-text-primary">
            <PageHeader title="Neraca Keuangan" subtitle="Posisi Aset, Kewajiban, dan Modal (Balance Sheet)." actions={
                <button onClick={() => fetchBalanceSheet(true)} className="btn-ghost-dark text-xs flex items-center gap-2">
                    <RotateCcw className="w-4 h-4"/> Refresh
                </button>
            }/>

            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="space-y-6">
                <BalanceSummaryCards reportData={reportData} loading={loading} />
                
                {/* Responsive Views */}
                <BalanceSheetTable reportData={reportData} details={details} loading={loading} />
                <BalanceSheetMobile reportData={reportData} details={details} loading={loading} />
            </motion.div>
        </div>
    );
}