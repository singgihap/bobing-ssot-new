"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, getAggregateFromServer, sum } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Calendar, Filter, RefreshCw, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const CACHE_PREFIX = 'lumina_report_v2_';
const CACHE_DURATION = 15 * 60 * 1000;

export default function ReportPLPage() {
    const [data, setData] = useState({ revenue: 0, cogs: 0, expenses: 0, details: {} });
    const [loading, setLoading] = useState(false);
    const [range, setRange] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0] 
    });

    useEffect(() => { generateReport(); }, []);

    const generateReport = async (forceRefresh = false) => {
        setLoading(true);
        const cacheKey = `${CACHE_PREFIX}${range.start}_${range.end}`;
        try {
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { data: cachedData, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setData(cachedData); setLoading(false); return;
                    }
                }
            }

            const start = new Date(range.start); start.setHours(0,0,0,0);
            const end = new Date(range.end); end.setHours(23,59,59,999);

            const salesSnapshot = await getAggregateFromServer(query(collection(db, "sales_orders"), where("order_date", ">=", start), where("order_date", "<=", end)), { totalRevenue: sum('net_amount'), totalCogs: sum('total_cost') });
            const rev = salesSnapshot.data().totalRevenue || 0;
            const cogs = salesSnapshot.data().totalCogs || 0;

            const snapExp = await getDocs(query(collection(db, "cash_transactions"), where("date", ">=", start), where("date", "<=", end), where("type", "==", "out")));
            let expTotal = 0; const expDet = {};
            const exclude = ['pembelian', 'transfer', 'prive']; 
            snapExp.forEach(d => {
                const t = d.data(); const cat = (t.category || 'Lainnya').toLowerCase();
                if(!exclude.includes(cat)) { expTotal += t.amount; expDet[cat] = (expDet[cat] || 0) + t.amount; }
            });

            const reportData = { revenue: rev, cogs: cogs, expenses: expTotal, details: expDet };
            setData(reportData);
            if (typeof window !== 'undefined') localStorage.setItem(cacheKey, JSON.stringify({ data: reportData, timestamp: Date.now() }));

        } catch(e) { console.error(e); toast.error("Gagal membuat laporan"); } finally { setLoading(false); }
    };

    const gross = data.revenue - data.cogs;
    const net = gross - data.expenses;
    const margin = data.revenue > 0 ? (net / data.revenue) * 100 : 0;

    return (
        <div className="max-w-4xl mx-auto space-y-8 fade-in pb-20">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><DollarSign className="w-5 h-5"/></div>
                    <div>
                        <h2 className="text-lg font-bold text-text-primary">Profit & Loss</h2>
                        <p className="text-xs text-text-secondary">Periode Laporan</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-border">
                    <div className="flex items-center gap-2 px-2 py-1 border-r border-gray-200">
                        <Calendar className="w-4 h-4 text-text-secondary"/>
                        <input type="date" className="bg-transparent text-xs font-medium text-text-primary focus:outline-none" value={range.start} onChange={e=>setRange({...range, start:e.target.value})} />
                    </div>
                    <span className="text-text-secondary text-xs">-</span>
                    <div className="px-2 py-1">
                        <input type="date" className="bg-transparent text-xs font-medium text-text-primary focus:outline-none" value={range.end} onChange={e=>setRange({...range, end:e.target.value})} />
                    </div>
                    <button onClick={() => generateReport(true)} className="btn-gold px-3 py-1.5 text-xs rounded-lg shadow-sm ml-2 flex items-center gap-1">
                        <Filter className="w-3 h-3"/> Filter
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-lg overflow-hidden">
                <div className="p-8 space-y-8 relative">
                    {/* Header Decorative */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full pointer-events-none"></div>

                    {/* SECTION: REVENUE */}
                    <div className="relative z-10">
                        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500"/> Revenue
                        </h3>
                        <div className="flex justify-between items-end border-b border-dashed border-border pb-4">
                            <span className="text-sm font-medium text-text-primary">Net Sales (Penjualan Bersih)</span>
                            <span className="text-2xl font-bold text-text-primary font-display">{formatRupiah(data.revenue)}</span>
                        </div>
                    </div>

                    {/* SECTION: COGS & GROSS */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-text-secondary">Cost of Goods Sold (HPP)</span>
                            <span className="font-mono font-medium text-rose-500">({formatRupiah(data.cogs)})</span>
                        </div>
                        <div className="bg-blue-50/50 p-4 rounded-xl flex justify-between items-center border border-blue-100">
                            <span className="font-bold text-blue-800 text-sm uppercase tracking-wide">Gross Profit</span>
                            <span className="font-bold text-xl text-blue-700 font-display">{formatRupiah(gross)}</span>
                        </div>
                    </div>

                    {/* SECTION: EXPENSES */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-rose-500"/> Expenses
                        </h3>
                        <div className="pl-4 space-y-2 border-l-2 border-gray-100">
                            {Object.entries(data.details).map(([k, v]) => (
                                <div key={k} className="flex justify-between text-sm">
                                    <span className="capitalize text-text-primary opacity-80">{k}</span>
                                    <span className="font-mono text-text-secondary">{formatRupiah(v)}</span>
                                </div>
                            ))}
                            {data.expenses === 0 && <p className="text-xs text-text-secondary italic">Tidak ada pengeluaran tercatat.</p>}
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                            <span className="font-bold text-text-primary text-sm">Total Expenses</span>
                            <span className="font-bold text-rose-500 font-mono">({formatRupiah(data.expenses)})</span>
                        </div>
                    </div>
                </div>

                {/* FOOTER: NET PROFIT */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-white flex justify-between items-center">
                    <div>
                        <span className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Net Profit / (Loss)</span>
                        <span className={`text-4xl font-display font-bold tracking-tight ${net < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatRupiah(net)}
                        </span>
                    </div>
                    <div className="text-right bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
                        <span className="block text-gray-300 text-xs mb-1">Net Margin</span>
                        <span className={`text-xl font-bold font-mono ${margin >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{margin.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}