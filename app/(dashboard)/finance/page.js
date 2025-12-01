"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import Skeleton from '@/components/Skeleton';
import Link from 'next/link';
import { getCache, setCache, DURATION } from '@/lib/cacheManager'; // Pastikan file ini sudah ada

// --- CHARTS ---
import { 
    Chart as ChartJS, 
    CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement 
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// --- ICONS ---
import { 
    Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, 
    PieChart, Activity, LayoutDashboard, FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

// Register ChartJS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const CACHE_KEY = 'lumina_finance_dash_v2'; // Cache key khusus halaman ini

export default function FinanceDashboard() {
    const [loading, setLoading] = useState(true);
    
    // Data States (Real Data SSOT)
    const [liquidity, setLiquidity] = useState({ cash: 0, debt: 0, receivable: 0 });
    const [cashFlow, setCashFlow] = useState({ in: 0, out: 0, net: 0 });
    const [chartData, setChartData] = useState(null);
    const [expenseData, setExpenseData] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache (5 Menit)
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = getCache(CACHE_KEY, DURATION.SHORT);
                if (cached) {
                    applyData(cached);
                    setLoading(false);
                    return;
                }
            }

            // 2. Fetch Live Data
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

            // A. Saldo Akun (Untuk Likuiditas SSOT)
            const accSnap = await getDocs(collection(db, "chart_of_accounts"));
            
            // B. Transaksi Bulan Ini (Untuk Cash Flow & Expense)
            const qTrans = query(
                collection(db, "cash_transactions"),
                where("date", ">=", firstDay),
                where("date", "<=", lastDay),
                orderBy("date", "asc")
            );
            const transSnap = await getDocs(qTrans);

            // --- PROSES DATA ---
            const data = processData(accSnap, transSnap);
            
            // Simpan Cache
            setCache(CACHE_KEY, data);
            applyData(data);

        } catch (e) {
            console.error("Finance Dash Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const processData = (accSnap, transSnap) => {
        // 1. Hitung Likuiditas dari Saldo Akun (Balance Sheet Item)
        let cash = 0, debt = 0, receivable = 0;
        
        accSnap.forEach(doc => {
            const a = doc.data();
            const code = String(a.code);
            const bal = parseFloat(a.balance) || 0;

            // KAS & BANK (11xx)
            if (code.startsWith('11')) cash += bal;
            // PIUTANG (12xx)
            if (code.startsWith('12')) receivable += bal;
            // HUTANG (21xx)
            if (code.startsWith('21')) debt += bal;
        });

        // 2. Hitung Cash Flow & Expense Breakdown dari Transaksi
        let totalIn = 0, totalOut = 0;
        const dailyFlow = {}; // Tanggal -> {in, out}
        const expenses = {};  // Kategori -> Amount

        transSnap.forEach(doc => {
            const t = doc.data();
            const amount = parseFloat(t.amount) || 0;
            const dateKey = t.date.toDate ? t.date.toDate().getDate() : new Date(t.date).getDate(); 

            // Init Daily
            if (!dailyFlow[dateKey]) dailyFlow[dateKey] = { in: 0, out: 0 };

            if (t.type === 'in') {
                totalIn += amount;
                dailyFlow[dateKey].in += amount;
            } else {
                totalOut += amount;
                dailyFlow[dateKey].out += amount;

                // Filter Expense (Kecuali HPP/Hutang agar grafik relevan)
                const catName = t.category || 'Lainnya';
                if (!catName.toLowerCase().includes('hutang') && !catName.toLowerCase().includes('pembelian')) {
                     expenses[catName] = (expenses[catName] || 0) + amount;
                }
            }
        });

        return {
            liquidity: { cash, debt, receivable },
            cashFlow: { in: totalIn, out: totalOut, net: totalIn - totalOut },
            dailyFlow,
            expenses
        };
    };

    const applyData = (data) => {
        setLiquidity(data.liquidity);
        setCashFlow(data.cashFlow);

        // Chart 1: Daily Cash Flow
        const labels = Object.keys(data.dailyFlow).sort((a,b)=>a-b);
        setChartData({
            labels: labels.map(d => `Tgl ${d}`),
            datasets: [
                {
                    label: 'Masuk',
                    data: labels.map(d => data.dailyFlow[d].in),
                    backgroundColor: '#10B981', // Emerald
                    borderRadius: 4,
                },
                {
                    label: 'Keluar',
                    data: labels.map(d => data.dailyFlow[d].out),
                    backgroundColor: '#F43F5E', // Rose
                    borderRadius: 4,
                }
            ]
        });

        // Chart 2: Expense Breakdown (Top 5)
        const sortedExp = Object.entries(data.expenses)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5);
        
        setExpenseData({
            labels: sortedExp.map(e => e[0]),
            datasets: [{
                data: sortedExp.map(e => e[1]),
                backgroundColor: ['#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'],
                borderWidth: 0,
            }]
        });
    };

    // --- UI COMPONENTS (ACCESSIBLE & MODERN) ---
    
    const KpiCard = ({ title, value, icon: Icon, colorClass, subValue }) => (
        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                {/* Accessibility Fix: Text lebih gelap (gray-500) */}
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
                {/* Accessibility Fix: Div bukan H3 untuk urutan heading */}
                <div className={`text-2xl font-display font-bold tracking-tight ${colorClass}`}>
                    {loading ? <Skeleton className="h-8 w-32"/> : value}
                </div>
                {subValue && <p className="text-xs text-gray-400 mt-1 font-medium">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600','50').replace('500','50').replace('700','50')} opacity-80`}>
                <Icon className={`w-6 h-6 ${colorClass}`}/>
            </div>
        </div>
    );

    const MenuCard = ({ title, desc, href, icon: Icon, color }) => (
        <Link href={href} className="group relative p-6 bg-white border border-border rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1 block">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} bg-opacity-10 text-opacity-100`}>
            <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">
            {title}
          </h2>
          {/* Accessibility Fix: Text gray-500 */}
          <p className="text-sm text-gray-500 leading-relaxed">
            {desc}
          </p>
        </Link>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 fade-in pb-20 text-text-primary">
            
            <PageHeader 
                title="Finance Dashboard" 
                subtitle="Pusat kendali arus kas dan kesehatan finansial (CFO View)." 
            />

            {/* 1. LIQUIDITY GRID (KPI) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard 
                    title="Total Kas & Bank" 
                    value={formatRupiah(liquidity.cash)} 
                    icon={Wallet} 
                    colorClass="text-emerald-600" 
                    subValue="Dana Likuid (Ready)"
                />
                <KpiCard 
                    title="Piutang Usaha (AR)" 
                    value={formatRupiah(liquidity.receivable)} 
                    icon={ArrowDownLeft} 
                    colorClass="text-blue-600" 
                    subValue="Uang di Luar (Pending)"
                />
                <KpiCard 
                    title="Hutang Usaha (AP)" 
                    value={formatRupiah(liquidity.debt)} 
                    icon={ArrowUpRight} 
                    colorClass="text-rose-600" 
                    subValue="Kewajiban Supplier"
                />
            </div>

            {/* 2. CHARTS AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cash Flow Chart */}
                <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="lg:col-span-2 bg-white p-6 rounded-2xl border border-border shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                                <Activity className="w-5 h-5 text-primary"/> Arus Kas Bulan Ini
                            </h3>
                            <p className="text-xs text-gray-500">Pemasukan vs Pengeluaran Harian</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${cashFlow.net >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            Net: {formatRupiah(cashFlow.net)}
                        </div>
                    </div>
                    <div className="h-64 relative w-full">
                        {chartData ? <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#f3f4f6' }, ticks: { font: {size: 10} } }, x: { grid: { display: false }, ticks: { font: {size: 10} } } }, plugins: { legend: { position: 'bottom' } } }} /> : <Skeleton className="h-full w-full"/>}
                    </div>
                </motion.div>

                {/* Expense Breakdown */}
                <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col">
                    <h3 className="font-bold text-lg text-text-primary flex items-center gap-2 mb-4">
                        <PieChart className="w-5 h-5 text-amber-500"/> Beban Operasional
                    </h3>
                    <div className="flex-1 relative flex items-center justify-center min-h-[200px]">
                        {expenseData ? (
                            expenseData.datasets[0].data.length > 0 ? 
                            <Doughnut data={expenseData} options={{ cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: {size: 10} } } } }} /> 
                            : <div className="text-center text-xs text-gray-400">Belum ada data beban.</div>
                        ) : <Skeleton className="w-40 h-40 rounded-full"/>}
                    </div>
                </motion.div>
            </div>

            {/* 3. MENU NAVIGATION */}
            <div>
                <h3 className="text-sm font-bold text-gray-600 uppercase mb-4 tracking-wider ml-1">
                    Menu Utama
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MenuCard 
                        title="Buku Kas (Jurnal)" 
                        desc="Catat transaksi harian manual."
                        href="/finance/cash"
                        icon={Wallet}
                        color="bg-blue-600"
                    />
                    <MenuCard 
                        title="Chart of Accounts" 
                        desc="Kelola daftar akun (COA)."
                        href="/finance/accounts"
                        icon={LayoutDashboard}
                        color="bg-purple-600"
                    />
                    <MenuCard 
                        title="Laporan Laba Rugi" 
                        desc="Analisa pendapatan vs beban."
                        href="/finance/reports"
                        icon={FileText}
                        color="bg-emerald-600"
                    />
                    <MenuCard 
                        title="Neraca Keuangan" 
                        desc="Posisi Aset, Kewajiban & Modal."
                        href="/finance/balance"
                        icon={PieChart}
                        color="bg-orange-600"
                    />
                </div>
            </div>

        </div>
    );
}