"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, getAggregateFromServer, sum } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

// --- KONFIGURASI CACHE (OPTIMIZED) ---
// Menggunakan localStorage agar cache persist antar sesi/tab
const CACHE_MASTER_KEY = 'lumina_dash_master_v2'; 
const CACHE_SALES_PREFIX = 'lumina_dash_sales_v2_'; 
const CACHE_DURATION_MASTER = 15 * 60 * 1000; // 15 Menit untuk Master Data (Hemat Reads)
const CACHE_DURATION_SALES = 5 * 60 * 1000;   // 5 Menit untuk Sales (Realtime but cached)

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [filterRange, setFilterRange] = useState('this_month');
    
    // Data States
    const [masterData, setMasterData] = useState(null);
    
    // UI States
    const [kpi, setKpi] = useState({ gross: 0, net: 0, profit: 0, margin: 0, cash: 0, inventoryAsset: 0, txCount: 0 });
    const [chartTrendData, setChartTrendData] = useState(null);
    const [chartChannelData, setChartChannelData] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [recentSales, setRecentSales] = useState([]);

    // 1. Fetch Master Data (Optimized)
    const fetchMasterData = async () => {
        // Cek Cache LocalStorage (Persist walau tab ditutup)
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(CACHE_MASTER_KEY);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_DURATION_MASTER) return data;
            }
        }

        // COST OPTIMIZATION: Gunakan Aggregation Query untuk Cash Balance
        // Biaya: 1 Read (berapapun jumlah dokumennya)
        const cashAggPromise = getAggregateFromServer(collection(db, "cash_accounts"), {
            totalBalance: sum('balance')
        });

        // Fetch Data Lain (Tetap diambil karena butuh detail untuk inventory value)
        const [snapCashAgg, snapStock, snapVar, snapProd] = await Promise.all([
            cashAggPromise,
            getDocs(collection(db, "stock_snapshots")),
            getDocs(collection(db, "product_variants")),
            getDocs(collection(db, "products"))
        ]);

        // Process Data
        const cashBalance = snapCashAgg.data().totalBalance || 0;
        
        const products = [];
        snapProd.forEach(d => products.push({ id: d.id, name: d.data().name }));
        
        const variants = [];
        snapVar.forEach(d => variants.push({ id: d.id, ...d.data() }));
        
        const stocks = [];
        snapStock.forEach(d => stocks.push({ ...d.data() }));

        const result = { cashBalance, products, variants, stocks };
        
        // Simpan Cache ke LocalStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_MASTER_KEY, JSON.stringify({ data: result, ts: Date.now() }));
        }
        return result;
    };

    // 2. Fetch Sales Data (Optimized Cache)
    const fetchSalesData = async (range) => {
        const cacheKey = `${CACHE_SALES_PREFIX}${range}`;
        
        // Cek Cache LocalStorage
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_DURATION_SALES) {
                    return data.map(d => ({
                        ...d,
                        order_date: new Date(d.order_date)
                    }));
                }
            }
        }

        // Tentukan Query Date
        const now = new Date();
        let start = new Date();
        let end = new Date();
        end.setHours(23, 59, 59, 999);

        if (range === 'today') start.setHours(0, 0, 0, 0);
        else if (range === 'this_month') start = new Date(now.getFullYear(), now.getMonth(), 1);
        else if (range === 'last_month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            end.setHours(23, 59, 59, 999);
        }

        // Fetch Firebase
        const q = query(
            collection(db, "sales_orders"), 
            where("order_date", ">=", start), 
            where("order_date", "<=", end), 
            orderBy("order_date", "asc")
        );
        const snap = await getDocs(q);
        
        const sales = [];
        snap.forEach(d => {
            const data = d.data();
            sales.push({
                id: d.id,
                ...data,
                order_date: data.order_date.toDate()
            });
        });

        // Simpan Cache LocalStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, JSON.stringify({ data: sales, ts: Date.now() }));
        }
        
        return sales;
    };

    // 3. Main Orchestrator
    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            try {
                let currentMaster = masterData;
                if (!currentMaster) {
                    currentMaster = await fetchMasterData();
                    setMasterData(currentMaster);
                }

                const sales = await fetchSalesData(filterRange);
                processDashboard(sales, currentMaster);

            } catch (e) {
                console.error("Dashboard Error:", e);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [filterRange]);

    // 4. Calculation Logic (Tetap Sama, hanya memastikan safety check)
    const processDashboard = (sales, master) => {
        if (!master) return;

        let totalGross = 0, totalNet = 0, totalCost = 0;
        const days = {};
        const channels = {};
        const prodStats = {};
        const recentList = [];

        sales.forEach(d => {
            totalGross += (d.gross_amount || 0);
            totalNet += (d.net_amount || 0);
            totalCost += (d.total_cost || 0);
            
            const dateStr = new Date(d.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            if (!days[dateStr]) days[dateStr] = { gross: 0, profit: 0 };
            days[dateStr].gross += d.gross_amount || 0;
            days[dateStr].profit += (d.net_amount || 0) - (d.total_cost || 0);

            const ch = (d.channel_id || 'manual').toUpperCase();
            channels[ch] = (channels[ch] || 0) + (d.gross_amount || 0);

            if (d.items_summary) {
                const parts = d.items_summary.split(', ');
                parts.forEach(p => {
                    const match = p.match(/(.*)\((\d+)\)/);
                    if (match) prodStats[match[1]] = (prodStats[match[1]] || 0) + parseInt(match[2]);
                });
            }

            recentList.push({ 
                id: d.order_number, 
                customer: d.customer_name, 
                amount: d.gross_amount, 
                status: d.payment_status, 
                time: d.order_date 
            });
        });

        // Inventory Logic
        let totalInvValue = 0;
        const lowStocks = [];
        
        const varMap = {}; 
        master.variants.forEach(v => varMap[v.id] = v);
        
        const prodMap = {}; 
        master.products.forEach(p => prodMap[p.id] = p.name);
        
        const stockAgg = {}; 
        master.stocks.forEach(s => { 
            if(s.qty > 0) stockAgg[s.variant_id] = (stockAgg[s.variant_id] || 0) + s.qty; 
        });

        Object.keys(varMap).forEach(vid => {
            const v = varMap[vid];
            const qty = stockAgg[vid] || 0;
            totalInvValue += (qty * (v.cost || 0));
            
            if (qty <= (v.min_stock || 5)) {
                lowStocks.push({ 
                    id: vid, 
                    sku: v.sku, 
                    name: prodMap[v.product_id] || 'Unknown', 
                    qty: qty, 
                    min: v.min_stock || 5 
                });
            }
        });

        const profit = totalNet - totalCost;
        const margin = totalGross > 0 ? (profit / totalGross) * 100 : 0;

        setKpi({ 
            gross: totalGross, 
            net: totalNet, 
            profit: profit, 
            margin: margin.toFixed(1), 
            txCount: sales.length, 
            cash: master.cashBalance, 
            inventoryAsset: totalInvValue 
        });

        setChartTrendData({
            labels: Object.keys(days),
            datasets: [
                { label: 'Omzet', data: Object.values(days).map(x=>x.gross), borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.1)', fill: true, tension: 0.4 },
                { label: 'Profit', data: Object.values(days).map(x=>x.profit), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }
            ]
        });

        setChartChannelData({
            labels: Object.keys(channels),
            datasets: [{ data: Object.values(channels), backgroundColor: ['#D4AF37', '#10B981', '#3B82F6', '#8B5CF6'], borderWidth: 0 }]
        });

        setTopProducts(Object.entries(prodStats).sort((a, b) => b[1] - a[1]).slice(0, 5));
        setLowStockItems(lowStocks.sort((a,b) => a.qty - b.qty).slice(0, 5));
        setRecentSales(recentList.reverse().slice(0, 5));
    };

    // --- SUB COMPONENTS (DARK MODE) ---
    const KpiCard = ({ title, value, sub, icon, color, loading }) => (
        <div className="card-luxury p-6 relative overflow-hidden group hover:border-lumina-gold/30 transition-all">
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[10px] font-bold text-lumina-muted uppercase tracking-widest mb-1">{title}</p>
                    <h3 className="text-2xl font-display font-bold text-lumina-text tracking-tight">
                        {loading ? <div className="h-8 w-32 bg-lumina-highlight rounded animate-pulse"></div> : value}
                    </h3>
                    <p className="text-xs text-lumina-muted mt-2 font-medium">{sub}</p>
                </div>
                <div className={`p-3 rounded-xl ${color === 'gold' ? 'bg-lumina-gold/10 text-lumina-gold' : 'bg-lumina-highlight text-lumina-text'}`}>
                    {icon}
                </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-lumina-gold/10 to-transparent rounded-full blur-2xl group-hover:bg-lumina-gold/20 transition-all duration-500"></div>
        </div>
    );

    return (
        <div className="space-y-8 fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-xl md:text-3xl font-display font-bold text-lumina-text tracking-tight">Executive Dashboard</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Real-time business intelligence & analytics.</p>
                </div>
                <div className="bg-lumina-surface p-1 rounded-lg border border-lumina-border shadow-lg">
                    <select value={filterRange} onChange={(e) => setFilterRange(e.target.value)} className="text-sm bg-transparent text-lumina-text font-medium cursor-pointer py-1.5 pl-3 pr-8 outline-none">
                        <option value="today" className="bg-lumina-base">Hari Ini</option>
                        <option value="this_month" className="bg-lumina-base">Bulan Ini</option>
                        <option value="last_month" className="bg-lumina-base">Bulan Lalu</option>
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Revenue" value={formatRupiah(kpi.gross)} sub={`${kpi.txCount} Transactions`} color="gold" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} loading={loading} />
                <KpiCard title="Net Profit" value={formatRupiah(kpi.profit)} sub={`Margin ${kpi.margin}%`} color="emerald" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>} loading={loading} />
                <KpiCard title="Liquid Cash" value={formatRupiah(kpi.cash)} sub="All Wallets" color="blue" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>} loading={loading} />
                <KpiCard title="Inventory Value" value={formatRupiah(kpi.inventoryAsset)} sub="Total Assets (HPP)" color="amber" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>} loading={loading} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 card-luxury p-6">
                    <h3 className="font-bold text-lumina-text mb-6">Performance Trend</h3>
                    <div className="h-72 w-full relative">
                        {chartTrendData ? <Line data={chartTrendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94A3B8' } } }, scales: { y: { grid: { color: '#2A2E3B' }, ticks: { color: '#94A3B8' } }, x: { grid: { display: false }, ticks: { color: '#94A3B8' } } } }} /> : <div className="h-full flex items-center justify-center text-lumina-muted">Loading Chart...</div>}
                    </div>
                </div>
                <div className="card-luxury p-6 flex flex-col">
                    <h3 className="font-bold text-lumina-text mb-6">Channel Mix</h3>
                    <div className="h-64 w-full relative flex justify-center items-center flex-1">
                         {chartChannelData ? <Doughnut data={chartChannelData} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8' } } } }} /> : <div className="text-lumina-muted">Loading Data...</div>}
                    </div>
                </div>
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Products */}
                <div className="card-luxury overflow-hidden">
                    <div className="px-6 py-4 border-b border-lumina-border bg-lumina-surface">
                        <h3 className="font-bold text-lumina-text text-sm uppercase tracking-wider">🔥 Top Products</h3>
                    </div>
                    <table className="table-dark">
                        <tbody>
                            {topProducts.map(([sku, qty], i) => (
                                <tr key={i} className="hover:bg-lumina-highlight">
                                    <td className="px-6 py-3 font-medium text-lumina-text">{sku}</td>
                                    <td className="px-6 py-3 text-right font-bold text-lumina-gold">{qty}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Low Stock */}
                <div className="card-luxury overflow-hidden border-rose-900/30">
                    <div className="px-6 py-4 border-b border-rose-900/30 bg-rose-900/10 flex justify-between items-center">
                        <h3 className="font-bold text-rose-400 text-sm uppercase tracking-wider">⚠️ Low Stock</h3>
                        <span className="text-[10px] bg-rose-900/20 border border-rose-900/30 text-rose-400 px-2 py-0.5 rounded">{lowStockItems.length} Items</span>
                    </div>
                    <div className="divide-y divide-lumina-border">
                        {lowStockItems.map((item, i) => (
                            <div key={i} className="px-6 py-3 flex justify-between items-center hover:bg-lumina-highlight transition">
                                <div>
                                    <p className="text-sm font-bold text-lumina-text">{item.sku}</p>
                                    <p className="text-xs text-lumina-muted truncate w-32">{item.name}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-rose-500 font-bold text-sm">{item.qty}</span>
                                    <span className="text-lumina-muted text-[10px] block">Min: {item.min}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Sales */}
                <div className="card-luxury overflow-hidden">
                    <div className="px-6 py-4 border-b border-lumina-border bg-lumina-surface">
                        <h3 className="font-bold text-lumina-text text-sm uppercase tracking-wider">⚡ Recent Sales</h3>
                    </div>
                    <div className="divide-y divide-lumina-border">
                        {recentSales.map((s, i) => (
                            <div key={i} className="px-6 py-3 flex justify-between items-center hover:bg-lumina-highlight transition">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lumina-text text-sm">{s.customer}</span>
                                        <span className="text-[10px] bg-lumina-highlight text-lumina-muted px-1.5 rounded">{s.id}</span>
                                    </div>
                                    <p className="text-[10px] text-lumina-muted">{s.time.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                                </div>
                                <span className="font-bold text-lumina-gold text-sm">{formatRupiah(s.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}