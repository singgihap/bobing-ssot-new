// app/dashboard/page.js
"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Dashboard() {
    // State Data
    const [loading, setLoading] = useState(true);
    const [filterRange, setFilterRange] = useState('this_month');
    
    // Metrics
    const [kpi, setKpi] = useState({ 
        gross: 0, net: 0, profit: 0, margin: 0, 
        cash: 0, inventoryAsset: 0, txCount: 0 
    });
    
    // Charts & Lists (Variabel diperbaiki agar konsisten)
    const [chartTrendData, setChartTrendData] = useState(null);
    const [chartChannelData, setChartChannelData] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [recentSales, setRecentSales] = useState([]);

    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            try {
                const now = new Date();
                let start = new Date();
                let end = new Date();
                end.setHours(23, 59, 59, 999);

                // 1. Date Filter Logic
                if (filterRange === 'today') start.setHours(0, 0, 0, 0);
                else if (filterRange === 'this_month') start = new Date(now.getFullYear(), now.getMonth(), 1);
                else if (filterRange === 'last_month') {
                    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    end = new Date(now.getFullYear(), now.getMonth(), 0);
                    end.setHours(23, 59, 59, 999);
                }

                // --- PARALLEL FETCHING ---
                const [snapSales, snapCashAcc, snapStock, snapVar, snapProd] = await Promise.all([
                    getDocs(query(collection(db, "sales_orders"), where("order_date", ">=", start), where("order_date", "<=", end), orderBy("order_date", "asc"))),
                    getDocs(collection(db, "cash_accounts")),
                    getDocs(collection(db, "stock_snapshots")),
                    getDocs(collection(db, "product_variants")),
                    getDocs(collection(db, "products"))
                ]);

                // --- PROCESSING SALES & KPI ---
                let totalGross = 0, totalNet = 0, totalCost = 0;
                const days = {};
                const channels = {};
                const prodStats = {};
                const recentList = [];

                // Sales Loop
                snapSales.forEach(doc => {
                    const d = doc.data();
                    totalGross += (d.gross_amount || 0);
                    totalNet += (d.net_amount || 0);
                    totalCost += (d.total_cost || 0);
                    
                    // Trend Harian
                    const dateStr = new Date(d.order_date.toDate()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    if (!days[dateStr]) days[dateStr] = { gross: 0, profit: 0 };
                    days[dateStr].gross += d.gross_amount || 0;
                    days[dateStr].profit += (d.net_amount || 0) - (d.total_cost || 0);

                    // Channel Share
                    const ch = (d.channel_id || 'manual').toUpperCase();
                    channels[ch] = (channels[ch] || 0) + (d.gross_amount || 0);

                    // Product Counter
                    if (d.items_summary) {
                        const parts = d.items_summary.split(', ');
                        parts.forEach(p => {
                            const match = p.match(/(.*)\((\d+)\)/);
                            if (match) prodStats[match[1]] = (prodStats[match[1]] || 0) + parseInt(match[2]);
                        });
                    }

                    // Recent Sales
                    recentList.push({
                        id: d.order_number,
                        customer: d.customer_name,
                        amount: d.gross_amount,
                        status: d.payment_status,
                        time: d.order_date.toDate()
                    });
                });

                // --- FINANCIAL HEALTH ---
                let totalCash = 0;
                snapCashAcc.forEach(d => totalCash += (d.data().balance || 0));

                // --- INVENTORY INSIGHTS ---
                let totalInvValue = 0;
                const lowStocks = [];
                
                const varMap = {}; 
                snapVar.forEach(d => { varMap[d.id] = { ...d.data(), id: d.id }; });
                
                const prodMap = {}; 
                snapProd.forEach(d => prodMap[d.id] = d.data().name);

                const stockAgg = {}; 
                snapStock.forEach(d => {
                    const s = d.data();
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

                // --- SET STATES ---
                const profit = totalNet - totalCost;
                const margin = totalGross > 0 ? (profit / totalGross) * 100 : 0;

                setKpi({
                    gross: totalGross,
                    net: totalNet,
                    profit: profit,
                    margin: margin.toFixed(1),
                    txCount: snapSales.size,
                    cash: totalCash,
                    inventoryAsset: totalInvValue
                });

                setChartTrendData({
                    labels: Object.keys(days),
                    datasets: [
                        { label: 'Omzet', data: Object.values(days).map(x=>x.gross), borderColor: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true, tension: 0.4 },
                        { label: 'Profit', data: Object.values(days).map(x=>x.profit), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }
                    ]
                });

                setChartChannelData({
                    labels: Object.keys(channels),
                    datasets: [{ data: Object.values(channels), backgroundColor: ['#F97316', '#10B981', '#3B82F6', '#8B5CF6'], borderWidth: 0 }]
                });

                setTopProducts(Object.entries(prodStats).sort((a, b) => b[1] - a[1]).slice(0, 5));
                setLowStockItems(lowStocks.sort((a,b) => a.qty - b.qty).slice(0, 5));
                setRecentSales(recentList.reverse().slice(0, 5));

            } catch (e) { console.error("Dashboard Error:", e); } 
            finally { setLoading(false); }
        };

        loadDashboard();
    }, [filterRange]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Eksekutif</h2>
                    <p className="text-sm text-gray-500 mt-1">Ringkasan performa bisnis & kesehatan aset.</p>
                </div>
                <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <select value={filterRange} onChange={(e) => setFilterRange(e.target.value)} className="text-sm border-none bg-transparent focus:ring-0 text-gray-700 font-semibold cursor-pointer py-1.5 pl-2 pr-8">
                        <option value="today">Hari Ini</option>
                        <option value="this_month">Bulan Ini</option>
                        <option value="last_month">Bulan Lalu</option>
                    </select>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Omzet" value={formatRupiah(kpi.gross)} sub={`${kpi.txCount} Transaksi`} color="gold" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}loading={loading} />
                <KpiCard title="Net Profit (Est)" value={formatRupiah(kpi.profit)} sub={`Margin ${kpi.margin}%`} color="emerald" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} loading={loading} />
                <KpiCard title="Posisi Kas (Liquid)" value={formatRupiah(kpi.cash)} sub="Saldo di semua dompet" color="blue" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} loading={loading} />
                <KpiCard title="Aset Stok (HPP)" value={formatRupiah(kpi.inventoryAsset)} sub="Nilai modal barang" color="amber" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} loading={loading} />
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 card p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800">Tren Penjualan & Profit</h3>
                    </div>
                    <div className="h-72 w-full relative">
                        {chartTrendData ? <Line data={chartTrendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /> : <Skeleton h="h-full" />}
                    </div>
                </div>
                <div className="card p-6 flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-6">Market Share</h3>
                    <div className="h-64 w-full relative flex justify-center items-center flex-1">
                         {chartChannelData ? <Doughnut data={chartChannelData} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }} /> : <Skeleton h="h-40 w-40 rounded-full" />}
                    </div>
                </div>
            </div>

            {/* INSIGHTS LISTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Products */}
                <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">🏆 Produk Terlaris</h3>
                    </div>
                    <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-gray-50">
                            {topProducts.map(([sku, qty], i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 text-gray-700 font-medium">{sku}</td>
                                    <td className="px-6 py-3 text-right font-bold text-brand-600">{qty}</td>
                                </tr>
                            ))}
                            {topProducts.length===0 && !loading && <tr><td className="p-6 text-center text-gray-400 italic">Belum ada data.</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* Low Stock Alert */}
                <div className="card p-0 overflow-hidden border-red-100">
                    <div className="px-6 py-4 border-b border-red-100 bg-red-50/30 flex justify-between items-center">
                        <h3 className="font-bold text-red-700 text-sm uppercase tracking-wider">⚠️ Stok Menipis</h3>
                        <span className="text-[10px] bg-white border border-red-200 text-red-600 px-2 py-0.5 rounded-full">{lowStockItems.length} Items</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {lowStockItems.map((item, i) => (
                            <div key={i} className="px-6 py-3 flex justify-between items-center hover:bg-red-50/20 transition">
                                <div>
                                    <p className="text-sm font-bold text-gray-800">{item.sku}</p>
                                    <p className="text-xs text-gray-500 truncate w-40">{item.name}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-red-600 font-bold text-sm">{item.qty}</span>
                                    <span className="text-gray-400 text-[10px] block">Min: {item.min}</span>
                                </div>
                            </div>
                        ))}
                        {lowStockItems.length===0 && !loading && <div className="p-6 text-center text-emerald-500 text-sm font-medium">Semua stok aman! ✨</div>}
                    </div>
                </div>

                {/* Recent Sales */}
                <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">⚡ Penjualan Terkini</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {recentSales.map((s, i) => (
                            <div key={i} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50 transition">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-700 text-sm">{s.customer}</span>
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded border">{s.id}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">{s.time.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                                </div>
                                <span className="font-bold text-brand-600 text-sm">{formatRupiah(s.amount)}</span>
                            </div>
                        ))}
                         {recentSales.length===0 && !loading && <div className="p-6 text-center text-gray-400 italic">Belum ada transaksi hari ini.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper Components
function KpiCard({ title, value, sub, icon, color, loading }) {
    // Warna dinamis untuk dark mode
    const colors = {
        gold: 'text-gold-400 bg-gold-500/10 border-gold-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        amber: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    };
    const theme = colors[color] || colors.gold;

    return (
        <div className="card p-6 relative overflow-hidden group hover:-translate-y-1 transition-all border-dark-700">
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[11px] font-bold text-light-500 uppercase tracking-wider mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-white tracking-tight font-sans">
                        {loading ? <div className="h-8 w-32 bg-dark-700 rounded animate-pulse"></div> : value}
                    </h3>
                    <p className="text-xs text-light-500 mt-2 font-medium">{sub}</p>
                </div>
                <div className={`p-3 rounded-xl shadow-sm ${theme}`}>
                    {icon}
                </div>
            </div>
            {/* Dekorasi Background Glow */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500 bg-current`}></div>
        </div>
    );
}

function Skeleton({ h }) {
    return <div className={`${h} w-full bg-gray-100 rounded animate-pulse`}></div>;
}