"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, getAggregateFromServer, sum } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_PREFIX = 'lumina_report_v2_';
const CACHE_DURATION = 15 * 60 * 1000; // 15 Menit

export default function ReportPLPage() {
    const [data, setData] = useState({ revenue: 0, cogs: 0, expenses: 0, details: {} });
    const [loading, setLoading] = useState(false);
    const [range, setRange] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0] 
    });

    useEffect(() => { 
        generateReport(); 
    }, []); // Load awal

    // Generate Report (Smart Caching & Aggregation)
    const generateReport = async (forceRefresh = false) => {
        setLoading(true);
        
        // 1. Generate Cache Key berdasarkan Tanggal
        const cacheKey = `${CACHE_PREFIX}${range.start}_${range.end}`;

        try {
            // 2. Cek Cache LocalStorage
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { data: cachedData, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setData(cachedData);
                        setLoading(false);
                        return; // Hemat Reads
                    }
                }
            }

            // 3. Fetch Data Real-time
            const start = new Date(range.start); start.setHours(0,0,0,0);
            const end = new Date(range.end); end.setHours(23,59,59,999);

            // A. Sales (Revenue & COGS) - MENGGUNAKAN AGGREGATION (Biaya: 1 Read)
            // Menggantikan pengambilan ribuan dokumen sales_orders
            const salesColl = collection(db, "sales_orders");
            const qSales = query(
                salesColl, 
                where("order_date", ">=", start), 
                where("order_date", "<=", end)
            );

            const salesSnapshot = await getAggregateFromServer(qSales, {
                totalRevenue: sum('net_amount'),
                totalCogs: sum('total_cost')
            });

            const rev = salesSnapshot.data().totalRevenue || 0;
            const cogs = salesSnapshot.data().totalCogs || 0;

            // B. Expenses (Cash Out) - Masih perlu fetch docs untuk breakdown kategori
            // Biasanya jumlah transaksi expense jauh lebih sedikit daripada sales
            const qExp = query(
                collection(db, "cash_transactions"), 
                where("date", ">=", start), 
                where("date", "<=", end), 
                where("type", "==", "out")
            );
            const snapExp = await getDocs(qExp);
            
            let expTotal = 0; 
            const expDet = {};
            const exclude = ['pembelian', 'transfer', 'prive']; 
            
            snapExp.forEach(d => {
                const t = d.data(); 
                const cat = (t.category || 'Lainnya').toLowerCase();
                // Filter kategori yang bukan expense operasional
                if(!exclude.includes(cat)) { 
                    expTotal += t.amount; 
                    expDet[cat] = (expDet[cat] || 0) + t.amount; 
                }
            });

            const reportData = { revenue: rev, cogs: cogs, expenses: expTotal, details: expDet };
            setData(reportData);

            // 4. Simpan Cache ke LocalStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: reportData,
                    timestamp: Date.now()
                }));
            }

        } catch(e) { 
            console.error(e); 
            toast.error("Gagal membuat laporan");
        } finally { 
            setLoading(false); 
        }
    };

    const gross = data.revenue - data.cogs;
    const net = gross - data.expenses;
    const margin = data.revenue > 0 ? (net / data.revenue) * 100 : 0;

    return (
        <div className="max-w-4xl mx-auto space-y-8 fade-in pb-20">
            {/* Header & Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
            <div>
                <h2 className="text-xl md:text-3xl font-bold text-lumina-text font-display">Profit & Loss</h2>
                <p className="text-sm text-lumina-muted font-light">Financial performance summary.</p>
            </div>
            {/* Filter & Refresh Button */}
            <div className="flex items-center gap-2 bg-lumina-surface p-1 rounded-lg border border-lumina-border shadow-lg">
                <input type="date" className="text-sm bg-transparent text-lumina-text border-none focus:ring-0 outline-none px-2" value={range.start} onChange={e=>setRange({...range, start:e.target.value})} />
                <span className="text-lumina-muted">-</span>
                <input type="date" className="text-sm bg-transparent text-lumina-text border-none focus:ring-0 outline-none px-2" value={range.end} onChange={e=>setRange({...range, end:e.target.value})} />
                <button onClick={() => generateReport(false)} className="btn-gold px-4 py-1 text-xs">
                {loading ? '...' : 'Filter'}
                </button>
                <button onClick={() => generateReport(true)} className="btn-ghost-dark px-3 py-1 text-xs border-l border-lumina-border ml-1" title="Force Refresh">
                ↻
                </button>
            </div>
            </div>


            <div className="card-luxury p-8 space-y-8 relative overflow-hidden">
                {/* Decorative Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-lumina-gold to-transparent opacity-50"></div>

                {/* REVENUE */}
                <div>
                    <h3 className="text-xs font-bold text-lumina-muted uppercase tracking-widest mb-3 border-b border-lumina-border pb-2">Revenue</h3>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-lumina-text">Net Sales</span>
                        <span className="font-bold text-xl text-lumina-text font-display">{formatRupiah(data.revenue)}</span>
                    </div>
                </div>

                {/* COGS */}
                <div>
                    <h3 className="text-xs font-bold text-lumina-muted uppercase tracking-widest mb-3 border-b border-lumina-border pb-2">Cost of Goods Sold</h3>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-lumina-text">HPP Product</span>
                        <span className="font-bold text-lg text-rose-400 font-mono">({formatRupiah(data.cogs)})</span>
                    </div>
                </div>

                {/* GROSS PROFIT */}
                <div className="bg-lumina-highlight/40 p-5 rounded-xl border border-lumina-border flex justify-between items-center">
                    <span className="font-bold text-lumina-gold text-sm uppercase tracking-widest">Gross Profit</span>
                    <span className="font-extrabold text-2xl text-lumina-text font-display">{formatRupiah(gross)}</span>
                </div>

                {/* EXPENSES */}
                <div>
                    <h3 className="text-xs font-bold text-lumina-muted uppercase tracking-widest mb-3 border-b border-lumina-border pb-2">Operating Expenses</h3>
                    <div className="space-y-3 pl-2 mb-4">
                        {Object.entries(data.details).map(([k, v]) => (
                            <div key={k} className="flex justify-between text-sm">
                                <span className="capitalize text-lumina-text opacity-80">{k}</span>
                                <span className="font-mono text-lumina-text">{formatRupiah(v)}</span>
                            </div>
                        ))}
                        {data.expenses === 0 && <p className="text-sm text-lumina-muted italic">No expenses recorded.</p>}
                    </div>
                    <div className="flex justify-between items-center border-t border-lumina-border pt-4 border-dashed">
                        <span className="font-bold text-lumina-text text-sm">Total Expenses</span>
                        <span className="font-bold text-rose-400 font-mono">({formatRupiah(data.expenses)})</span>
                    </div>
                </div>

                {/* NET PROFIT */}
                <div className="bg-gradient-to-r from-lumina-surface to-lumina-highlight p-8 rounded-2xl shadow-2xl border border-lumina-border flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                        <span className="block text-lumina-muted text-xs font-bold uppercase tracking-widest mb-2">Net Profit</span>
                        <span className={`text-4xl font-display font-extrabold tracking-tight ${net < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>{formatRupiah(net)}</span>
                    </div>
                    <div className="relative z-10 text-right">
                        <span className="block text-lumina-muted text-xs mb-1">Net Margin</span>
                        <span className={`text-2xl font-bold font-mono ${margin >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{margin.toFixed(1)}%</span>
                    </div>
                    
                    {/* Glow Effect based on Profit */}
                    <div className={`absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl opacity-10 ${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                </div>
            </div>
        </div>
    );
}