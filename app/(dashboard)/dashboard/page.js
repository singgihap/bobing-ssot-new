// app\(dashboard)\dashboard\page.js

"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, getAggregateFromServer, sum, doc, getDoc, limit } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import PageHeader from '@/components/PageHeader'; 
import Skeleton from '@/components/Skeleton'; 
import { TrophyIcon, AlertIcon, FlashIcon } from '@/components/DashboardIcons';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

// --- KONFIGURASI CACHE (Tidak ada perubahan) ---
const CACHE_MASTER_KEY = 'lumina_dash_master_v3'; 
const CACHE_SALES_PREFIX = 'lumina_dash_sales_v3_'; 
const CACHE_DURATION_MASTER = 30 * 60 * 1000; 
const CACHE_DURATION_SALES = 5 * 60 * 1000;   

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

    // [... Logika fetchMasterData dan fetchSalesData (Dihilangkan untuk keringkasan) ...]

    // 1. Fetch Master Data (Optimized: Aggregation + LocalStorage)
    const fetchMasterData = async () => {
        // Cek Cache LocalStorage
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(CACHE_MASTER_KEY);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_DURATION_MASTER) return data;
            }
        }

        // A. Cash Balance via Aggregation (1 Read)
        const cashAggPromise = getAggregateFromServer(collection(db, "cash_accounts"), {
            totalBalance: sum('balance')
        });

        // B. Inventory Stats via Cloud Function Aggregation Doc (1 Read)
        const invStatsPromise = getDoc(doc(db, "stats_inventory", "general"));

        // C. Low Stock Items via Query (Hanya ambil yg <= 5, limit 10) - Hemat Reads
        const lowStockPromise = getDocs(query(collection(db, "stock_snapshots"), where("qty", "<=", 5), limit(10)));

        // D. Master Products & Variants (Untuk mapping nama)
        const productsPromise = getDocs(collection(db, "products"));
        const variantsPromise = getDocs(collection(db, "product_variants"));

        const [snapCashAgg, snapInvStats, snapLowStock, snapProd, snapVar] = await Promise.all([
            cashAggPromise,
            invStatsPromise,
            lowStockPromise,
            productsPromise,
            variantsPromise
        ]);

        // Process Data
        const cashBalance = snapCashAgg.data().totalBalance || 0;
        
        // Ambil data Inventory Value langsung dari dokumen stat (hasil kerja Cloud Function)
        const invData = snapInvStats.exists() ? snapInvStats.data() : { total_value: 0, total_qty: 0 };

        const products = [];
        snapProd.forEach(d => products.push({ id: d.id, name: d.data().name }));
        
        const variants = [];
        snapVar.forEach(d => variants.push({ id: d.id, ...d.data() }));
        
        // Process Low Stock (Mapping ID ke Nama)
        const lowStocks = [];
        snapLowStock.forEach(d => {
            const s = d.data();
            const v = variants.find(vr => vr.id === s.variant_id);
            const p = v ? products.find(pr => pr.id === v.product_id) : null;
            if (v && p) {
                lowStocks.push({
                    id: d.id,
                    sku: v.sku,
                    name: p.name,
                    qty: s.qty,
                    min: v.min_stock || 5
                });
            }
        });

        const result = { cashBalance, products, variants, lowStocks, invStats: invData };
        
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_MASTER_KEY, JSON.stringify({ data: result, ts: Date.now() }));
        }
        return result;
    };

    // 2. Fetch Sales Data (Optimized Cache)
    const fetchSalesData = async (range) => {
        const cacheKey = `${CACHE_SALES_PREFIX}${range}`;
        
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_DURATION_SALES) {
                    return data.map(d => ({ ...d, order_date: new Date(d.order_date) }));
                }
            }
        }

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

        const q = query(collection(db, "sales_orders"), where("order_date", ">=", start), where("order_date", "<=", end), orderBy("order_date", "asc"));
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

    // 4. Calculation Logic
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

        const profit = totalNet - totalCost;
        const margin = totalGross > 0 ? (profit / totalGross) * 100 : 0;

        setKpi({ 
            gross: totalGross, 
            net: totalNet, 
            profit: profit, 
            margin: margin.toFixed(1), 
            txCount: sales.length, 
            cash: master.cashBalance, 
            // AMBIL DARI STATS CLOUD FUNCTION, BUKAN HITUNG MANUAL
            inventoryAsset: master.invStats ? master.invStats.total_value : 0 
        });

        setChartTrendData({
            labels: Object.keys(days),
            datasets: [
                { 
                    label: 'Omzet', 
                    data: Object.values(days).map(x=>x.gross), 
                    // KOREKSI 1: Mengganti warna Gold dengan Primary (Biru Vibrant)
                    borderColor: '#2563EB', 
                    backgroundColor: 'rgba(37, 99, 235, 0.1)', 
                    fill: true, 
                    tension: 0.4 
                },
                { 
                    label: 'Profit', 
                    data: Object.values(days).map(x=>x.profit), 
                    // Tetap menggunakan warna hijau fungsional
                    borderColor: '#10B981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                    fill: true, 
                    tension: 0.4 
                }
            ]
        });

        setChartChannelData({
            labels: Object.keys(channels),
            datasets: [{ 
                data: Object.values(channels), 
                // KOREKSI 2: Mengganti warna Doughnut (Gold -> Primary, Emerald, Accent, Amber)
                backgroundColor: [
                    '#2563EB',  // Primary (Omzet utama)
                    '#844fc1',  // Accent (Ungu Premium)
                    '#34E9E1',  // Secondary (Aqua Water)
                    '#FFC857'   // Accent-Gold (Opsional)
                ], 
                borderWidth: 0 
            }]
        });

        setTopProducts(Object.entries(prodStats).sort((a, b) => b[1] - a[1]).slice(0, 5));
        setLowStockItems(master.lowStocks || []); 
        setRecentSales(recentList.reverse().slice(0, 5));
    };

    // --- UI COMPONENTS ---
    // --- UI COMPONENTS ---
    const KpiCard = ({ title, value, sub, icon, color, loading }) => (
        <div className="card-luxury p-6 relative overflow-hidden group hover:border-primary/30 transition-all">
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">{title}</p>
                    <h3 className="text-2xl font-display font-bold text-text-primary tracking-tight">
                        {loading ? <Skeleton className="h-8 w-32" /> : value}
                    </h3>
                    <p className="text-xs text-text-secondary mt-2 font-medium">{sub}</p>
                </div>
                <div className={`p-3 rounded-xl ${color === 'gold' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-text-primary'}`}>
                    {icon}
                </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500"></div>
        </div>
    );

    return (
        <div className="space-y-8 fade-in pb-20">
            
            <PageHeader 
                title="Executive Dashboard" 
                subtitle="Real-time business intelligence & analytics."
            >
                <div className="w-full md:w-auto bg-surface p-1 rounded-xl border border-border shadow-lg">
                    <select 
                        value={filterRange} 
                        onChange={(e) => setFilterRange(e.target.value)} 
                        className="w-full md:w-auto text-sm bg-transparent text-text-primary font-medium cursor-pointer py-2 px-4 outline-none appearance-none text-center"
                    >
                        <option value="today" className="bg-surface">Hari Ini</option>
                        <option value="this_month" className="bg-surface">Bulan Ini</option>
                        <option value="last_month" className="bg-surface">Bulan Lalu</option>
                    </select>
                </div>
            </PageHeader>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Revenue" value={formatRupiah(kpi.gross)} sub={`${kpi.txCount} Transactions`} color="gold" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} loading={loading} />
                <KpiCard title="Net Profit" value={formatRupiah(kpi.profit)} sub={`Margin ${kpi.margin}%`} color="emerald" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>} loading={loading} />
                <KpiCard title="Liquid Cash" value={formatRupiah(kpi.cash)} sub="All Wallets" color="blue" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>} loading={loading} />
                <KpiCard title="Inventory Value" value={formatRupiah(kpi.inventoryAsset)} sub="Cloud Aggregated" color="amber" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>} loading={loading} />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 card-luxury p-6">
                    <h3 className="font-bold text-text-primary mb-6">Performance Trend</h3>
                    <div className="h-72 w-full relative">
                        {chartTrendData ? <Line data={chartTrendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#4B5563' } } }, scales: { y: { grid: { color: '#E5E7EB' }, ticks: { color: '#6B7280' } }, x: { grid: { display: false }, ticks: { color: '#6B7280' } } } }} /> : <Skeleton className="h-full w-full" />}
                    </div>
                </div>
                <div className="card-luxury p-6 flex flex-col">
                    <h3 className="font-bold text-text-primary mb-6">Channel Mix</h3>
                    <div className="h-64 w-full relative flex justify-center items-center flex-1">
                         {chartChannelData ? <Doughnut data={chartChannelData} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: '#6B7280' } } } }} /> : <Skeleton className="h-48 w-48 rounded-full" />}
                    </div>
                </div>
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Products */}
                <div className="card-luxury overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-gray-100 flex items-center gap-2">
                        {/* MENGGANTI 🔥 dengan SVG TrophyIcon, diimpor dari DashboardIcons */}
                        <TrophyIcon className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider">Top Products</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table-dark w-full">
                            <tbody>
                                {topProducts.map(([sku, qty], i) => (
                                    <tr key={i} className="hover:bg-gray-100">
                                        <td className="px-6 py-3 font-medium text-text-primary">{sku}</td>
                                        <td className="px-6 py-3 text-right font-bold text-primary">{qty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Low Stock */}
                <div className="card-luxury overflow-hidden border-rose-900/30">
                    <div className="px-6 py-4 border-b border-rose-900/30 bg-rose-900/10 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             {/* MENGGANTI ⚠️ dengan SVG AlertIcon, diimpor dari DashboardIcons */}
                             <AlertIcon className="w-4 h-4 text-rose-400" />
                            <h3 className="font-bold text-rose-400 text-sm uppercase tracking-wider">Low Stock</h3>
                        </div>
                        <span className="text-[10px] bg-rose-900/20 border border-rose-900/30 text-rose-400 px-2 py-0.5 rounded">{lowStockItems.length} Items</span>
                    </div>
                    <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                        {lowStockItems.map((item, i) => (
                            <div key={i} className="px-6 py-3 flex justify-between items-center hover:bg-gray-100 transition">
                                <div>
                                    <p className="text-sm font-bold text-text-primary">{item.sku}</p>
                                    <p className="text-xs text-text-secondary truncate w-32">{item.name}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-rose-500 font-bold text-sm">{item.qty}</span>
                                    <span className="text-text-secondary text-[10px] block">Min: {item.min}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Sales */}
                <div className="card-luxury overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-gray-100 flex items-center gap-2">
                        {/* MENGGANTI ⚡ dengan SVG FlashIcon, diimpor dari DashboardIcons */}
                        <FlashIcon className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider">Recent Sales</h3>
                    </div>
                    <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                        {recentSales.map((s, i) => (
                            <div key={i} className="px-6 py-3 flex justify-between items-center hover:bg-gray-100 transition">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-text-primary text-sm">{s.customer}</span>
                                        <span className="text-[10px] bg-gray-100 text-text-secondary px-1.5 rounded">{s.id}</span>
                                    </div>
                                    <p className="text-[10px] text-text-secondary">{s.time ? s.time.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</p>
                                </div>
                                <span className="font-bold text-primary text-sm">{formatRupiah(s.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}