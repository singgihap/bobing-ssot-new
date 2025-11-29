"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, getAggregateFromServer, sum, doc, getDoc, limit } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import PageHeader from '@/components/PageHeader'; 
import Skeleton from '@/components/Skeleton'; 

// --- MODERN UI IMPORTS ---
import { 
    TrendingUp, DollarSign, Wallet, Package, ArrowUpRight, 
    AlertTriangle, ShoppingBag, Calendar, Filter, ChevronRight 
} from 'lucide-react';
import { motion } from 'framer-motion';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

// --- KONFIGURASI CACHE ---
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

    // 1. Fetch Master Data
    const fetchMasterData = async () => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(CACHE_MASTER_KEY);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_DURATION_MASTER) return data;
            }
        }

        const cashAggPromise = getAggregateFromServer(collection(db, "cash_accounts"), { totalBalance: sum('balance') });
        const invStatsPromise = getDoc(doc(db, "stats_inventory", "general"));
        const lowStockPromise = getDocs(query(collection(db, "stock_snapshots"), where("qty", "<=", 5), limit(10)));
        const productsPromise = getDocs(collection(db, "products"));
        const variantsPromise = getDocs(collection(db, "product_variants"));

        const [snapCashAgg, snapInvStats, snapLowStock, snapProd, snapVar] = await Promise.all([
            cashAggPromise, invStatsPromise, lowStockPromise, productsPromise, variantsPromise
        ]);

        const cashBalance = snapCashAgg.data().totalBalance || 0;
        const invData = snapInvStats.exists() ? snapInvStats.data() : { total_value: 0, total_qty: 0 };

        const products = [];
        snapProd.forEach(d => products.push({ id: d.id, name: d.data().name }));
        
        const variants = [];
        snapVar.forEach(d => variants.push({ id: d.id, ...d.data() }));
        
        const lowStocks = [];
        snapLowStock.forEach(d => {
            const s = d.data();
            const v = variants.find(vr => vr.id === s.variant_id);
            const p = v ? products.find(pr => pr.id === v.product_id) : null;
            if (v && p) {
                lowStocks.push({
                    id: d.id, sku: v.sku, name: p.name, qty: s.qty, min: v.min_stock || 5
                });
            }
        });

        const result = { cashBalance, products, variants, lowStocks, invStats: invData };
        if (typeof window !== 'undefined') localStorage.setItem(CACHE_MASTER_KEY, JSON.stringify({ data: result, ts: Date.now() }));
        return result;
    };

    // 2. Fetch Sales Data
    const fetchSalesData = async (range) => {
        const cacheKey = `${CACHE_SALES_PREFIX}${range}`;
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_DURATION_SALES) return data.map(d => ({ ...d, order_date: new Date(d.order_date) }));
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
            sales.push({ id: d.id, ...data, order_date: data.order_date.toDate() });
        });

        if (typeof window !== 'undefined') localStorage.setItem(cacheKey, JSON.stringify({ data: sales, ts: Date.now() }));
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
            } catch (e) { console.error("Dashboard Error:", e); } finally { setLoading(false); }
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
            gross: totalGross, net: totalNet, profit: profit, margin: margin.toFixed(1), 
            txCount: sales.length, cash: master.cashBalance, inventoryAsset: master.invStats ? master.invStats.total_value : 0 
        });

        setChartTrendData({
            labels: Object.keys(days),
            datasets: [
                { 
                    label: 'Omzet', data: Object.values(days).map(x=>x.gross), 
                    borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.4 
                },
                { 
                    label: 'Profit', data: Object.values(days).map(x=>x.profit), 
                    borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 
                }
            ]
        });

        setChartChannelData({
            labels: Object.keys(channels),
            datasets: [{ 
                data: Object.values(channels), 
                backgroundColor: ['#2563EB', '#844fc1', '#34E9E1', '#FFC857'], 
                borderWidth: 0 
            }]
        });

        setTopProducts(Object.entries(prodStats).sort((a, b) => b[1] - a[1]).slice(0, 5));
        setLowStockItems(master.lowStocks || []); 
        setRecentSales(recentList.reverse().slice(0, 5));
    };

    // --- COMPONENTS ---
    const KpiCard = ({ title, value, sub, icon: Icon, color, delay }) => {
        const colorClasses = {
            blue: 'text-blue-600 bg-blue-50 border-blue-100',
            emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
            amber: 'text-amber-600 bg-amber-50 border-amber-100',
            purple: 'text-purple-600 bg-purple-50 border-purple-100',
        };
        const activeClass = colorClasses[color] || colorClasses.blue;

        return (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay }}
                className="bg-white p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
            >
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">{title}</p>
                        <h3 className="text-2xl font-display font-bold text-text-primary tracking-tight">
                            {loading ? <Skeleton className="h-8 w-24" /> : value}
                        </h3>
                        <div className="flex items-center gap-1 mt-2">
                            {sub && <span className="text-[10px] font-medium bg-gray-50 text-text-secondary px-2 py-0.5 rounded border border-border/50">{sub}</span>}
                        </div>
                    </div>
                    <div className={`p-3 rounded-xl border ${activeClass}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-5 ${activeClass.split(' ')[1]}`}></div>
            </motion.div>
        );
    };

    return (
        <div className="space-y-8 fade-in pb-20 text-text-primary">
            
            <PageHeader 
                title="Dashboard" 
                subtitle="Ringkasan performa bisnis real-time."
                actions={
                    <div className="relative">
                        <select 
                            value={filterRange} 
                            onChange={(e) => setFilterRange(e.target.value)} 
                            className="appearance-none pl-9 pr-8 py-2 bg-white border border-border rounded-xl text-xs font-bold text-text-primary shadow-sm focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="today">Hari Ini</option>
                            <option value="this_month">Bulan Ini</option>
                            <option value="last_month">Bulan Lalu</option>
                        </select>
                        <Calendar className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
                        <div className="absolute right-3 top-2.5 pointer-events-none text-text-secondary">
                            <ChevronRight className="w-3 h-3 rotate-90" />
                        </div>
                    </div>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Revenue" value={formatRupiah(kpi.gross)} sub={`${kpi.txCount} Transaksi`} color="blue" icon={DollarSign} delay={0.1} loading={loading} />
                <KpiCard title="Net Profit" value={formatRupiah(kpi.profit)} sub={`Margin ${kpi.margin}%`} color="emerald" icon={TrendingUp} delay={0.2} loading={loading} />
                <KpiCard title="Liquid Cash" value={formatRupiah(kpi.cash)} sub="Total Saldo Kas" color="purple" icon={Wallet} delay={0.3} loading={loading} />
                <KpiCard title="Inventory Value" value={formatRupiah(kpi.inventoryAsset)} sub="Total Aset Stok" color="amber" icon={Package} delay={0.4} loading={loading} />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div 
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                    className="lg:col-span-2 bg-white p-6 rounded-2xl border border-border shadow-sm"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-primary"/> Performance Trend
                        </h3>
                    </div>
                    <div className="h-72 w-full relative">
                        {chartTrendData ? <Line data={chartTrendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#6B7280', font: {size: 11} }, usePointStyle: true } }, scales: { y: { grid: { color: '#F3F4F6' }, ticks: { color: '#9CA3AF', font: {size: 10} } }, x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: {size: 10} } } } }} /> : <Skeleton className="h-full w-full" />}
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                    className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col"
                >
                    <h3 className="font-bold text-text-primary text-sm mb-4 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-accent"/> Channel Mix
                    </h3>
                    <div className="h-56 w-full relative flex justify-center items-center flex-1">
                         {chartChannelData ? <Doughnut data={chartChannelData} options={{ responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom', labels: { color: '#6B7280', font: {size: 10}, usePointStyle: true, padding: 20 } } } }} /> : <Skeleton className="h-40 w-40 rounded-full" />}
                    </div>
                </motion.div>
            </div>

            {/* Widget Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Top Products */}
                <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="px-5 py-4 border-b border-border bg-gray-50/50 flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600"><TrendingUp className="w-3.5 h-3.5"/></div>
                        <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider">Top Products</h3>
                    </div>
                    <div className="p-2 overflow-y-auto max-h-[300px] custom-scrollbar">
                        {topProducts.length === 0 ? <p className="text-center text-xs text-text-secondary py-4">No data</p> : 
                        topProducts.map(([sku, qty], i) => (
                            <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-text-secondary">{i+1}</div>
                                    <span className="font-medium text-sm text-text-primary">{sku}</span>
                                </div>
                                <span className="font-bold text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-md">{qty} Sold</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Low Stock */}
                <div className="bg-white border border-rose-100 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600"><AlertTriangle className="w-3.5 h-3.5"/></div>
                            <h3 className="font-bold text-rose-700 text-xs uppercase tracking-wider">Low Stock</h3>
                        </div>
                        <span className="text-[10px] bg-white border border-rose-200 text-rose-600 px-2 py-0.5 rounded-full font-bold">{lowStockItems.length}</span>
                    </div>
                    <div className="divide-y divide-rose-50 overflow-y-auto max-h-[300px] custom-scrollbar">
                        {lowStockItems.length === 0 ? <p className="text-center text-xs text-text-secondary py-4">Stock aman</p> : 
                        lowStockItems.map((item, i) => (
                            <div key={i} className="px-5 py-3 hover:bg-rose-50/20 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-bold text-text-primary">{item.sku}</p>
                                        <p className="text-[10px] text-text-secondary truncate w-32">{item.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-rose-600 font-bold text-xs">{item.qty} Unit</span>
                                        <span className="text-[9px] text-rose-400 block">Min: {item.min}</span>
                                    </div>
                                </div>
                                <div className="w-full h-1 bg-rose-100 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min((item.qty/item.min)*100, 100)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Sales */}
                <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="px-5 py-4 border-b border-border bg-gray-50/50 flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600"><ShoppingBag className="w-3.5 h-3.5"/></div>
                        <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider">Live Sales</h3>
                    </div>
                    <div className="p-2 overflow-y-auto max-h-[300px] custom-scrollbar">
                        {recentSales.length === 0 ? <p className="text-center text-xs text-text-secondary py-4">Belum ada penjualan</p> : 
                        recentSales.map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                        {s.customer.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs text-text-primary">{s.customer}</span>
                                            <span className="text-[9px] text-text-secondary px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200">{s.id}</span>
                                        </div>
                                        <p className="text-[10px] text-text-secondary mt-0.5">{s.time ? s.time.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</p>
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-xs text-emerald-600">{formatRupiah(s.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}