'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_KEY = 'lumina_sales_history_v2'; // Cache di localStorage agar awet
const CACHE_DURATION = 5 * 60 * 1000; // 5 Menit

export default function TransactionsHistoryPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterChannel, setFilterChannel] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [expandedOrders, setExpandedOrders] = useState({});

    useEffect(() => { 
        fetchOrders(); 
    }, []);

    const fetchOrders = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache LocalStorage (Persist walau tab ditutup)
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        // Revive dates (JSON string -> Date Object)
                        const revived = data.map(o => ({ ...o, order_date: new Date(o.order_date) }));
                        setOrders(revived);
                        setLoading(false);
                        return;
                    }
                }
            }

            // 2. Fetch Firebase (Limit 100 agar ringan & hemat)
            const q = query(
                collection(db, "sales_orders"), 
                orderBy("order_date", "desc"), 
                limit(100)
            );
            const snap = await getDocs(q);
            
            const ordersList = [];
            snap.forEach(d => {
                const data = d.data();
                ordersList.push({
                    id: d.id,
                    ...data,
                    order_date: data.order_date.toDate() // Convert timestamp
                });
            });
            
            setOrders(ordersList);
            
            // 3. Simpan Cache ke LocalStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: ordersList, 
                    timestamp: Date.now()
                }));
            }

        } catch(e) {
            console.error('Error fetching orders:', e);
            toast.error("Gagal memuat riwayat transaksi");
        } finally {
            setLoading(false);
        }
    };

    // Filter orders logic (Client Side - karena data sudah di-limit 100 terbaru)
    const filteredOrders = orders.filter(order => {
        const matchChannel = filterChannel === 'all' || order.channel_id === filterChannel;
        const matchStatus = filterStatus === 'all' || order.status === filterStatus;
        const matchSearch = !searchQuery || 
            order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.items_summary || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchDate = true;
        if(dateRange.from) {
            const d = new Date(order.order_date);
            matchDate = d >= new Date(dateRange.from);
        }
        if(dateRange.to) {
            const d = new Date(order.order_date);
            const to = new Date(dateRange.to); to.setHours(23,59,59);
            matchDate = matchDate && d <= to;
        }
        
        return matchChannel && matchStatus && matchSearch && matchDate;
    });

    // Get unique values
    const channels = ['all', ...new Set(orders.map(o => o.channel_id).filter(Boolean))];
    const statuses = ['all', ...new Set(orders.map(o => o.status).filter(Boolean))];

    // Key metrics calculation based on filtered data
    const metrics = {
        totalOrders: filteredOrders.length,
        totalRevenue: filteredOrders.reduce((sum, o) => sum + (o.gross_amount || 0), 0),
        totalCost: filteredOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0),
        totalProfit: filteredOrders.reduce((sum, o) => sum + (o.profit || 0), 0),
        avgOrderValue: filteredOrders.length > 0 ? filteredOrders.reduce((sum, o) => sum + (o.gross_amount || 0), 0) / filteredOrders.length : 0
    };

    const profitMargin = metrics.totalRevenue > 0 ? ((metrics.totalProfit / metrics.totalRevenue) * 100).toFixed(1) : 0;

    const formatDate = (date) => {
        if(!date) return '-';
        return new Date(date).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const toggleOrderExpand = (orderId) => {
        setExpandedOrders(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    // Parse items helper
    const parseItems = (itemsSummary) => {
        if (!itemsSummary) return [];
        return itemsSummary.split(',').map(item => {
            const match = item.trim().match(/^(.+?)\((\d+)\)$/);
            return {
                sku: match ? match[1] : item.trim(),
                qty: match ? parseInt(match[2]) : 1
            };
        });
    };

    return (
        <div className="max-w-full mx-auto space-y-8 fade-in pb-20 px-4">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-display font-bold text-lumina-text">Transactions History</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Track all sales orders from imports and manual entries.</p>
                </div>
                <button onClick={() => fetchOrders(true)} className="btn-gold text-sm">↻ Refresh</button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Total Orders</p>
                    <h3 className="text-3xl font-display font-bold text-lumina-gold">{metrics.totalOrders}</h3>
                    <p className="text-xs text-lumina-muted mt-2">visible orders</p>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Revenue</p>
                    <h3 className="text-2xl font-display font-bold text-emerald-400">{formatRupiah(metrics.totalRevenue)}</h3>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Total Cost</p>
                    <h3 className="text-2xl font-display font-bold text-orange-400">{formatRupiah(metrics.totalCost)}</h3>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Profit</p>
                    <h3 className="text-2xl font-display font-bold text-blue-400">{formatRupiah(metrics.totalProfit)}</h3>
                    <p className="text-xs text-lumina-muted mt-2">{profitMargin}% margin</p>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Avg Order Value</p>
                    <h3 className="text-2xl font-display font-bold text-purple-400">{formatRupiah(metrics.avgOrderValue)}</h3>
                </div>
            </div>

            {/* Filters */}
            <div className="card-luxury p-6 space-y-4">
                <h4 className="font-semibold text-lumina-text">Filters (Local)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">Channel</label>
                        <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="input-luxury w-full text-xs">
                            {channels.map(c => <option key={c} value={c}>{c === 'all' ? 'All Channels' : c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">Status</label>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-luxury w-full text-xs">
                            {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">From Date</label>
                        <input type="date" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} className="input-luxury w-full text-xs" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">To Date</label>
                        <input type="date" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} className="input-luxury w-full text-xs" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">Search</label>
                        <input type="text" placeholder="Order # or buyer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-luxury w-full text-xs" />
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="card-luxury overflow-hidden">
                <div className="px-6 py-4 border-b border-lumina-border bg-lumina-surface/50 flex justify-between items-center">
                    <h2 className="font-bold text-lumina-text text-sm uppercase tracking-wider">Sales Orders (Last 100)</h2>
                    <div className="text-[10px] font-medium text-lumina-muted bg-lumina-highlight px-2 py-1 rounded">
                        {filteredOrders.length} visible
                    </div>
                </div>
                <div className="table-wrapper-dark border-none shadow-none rounded-none overflow-x-auto">
                    <table className="table-dark w-full min-w-full text-xs">
                        <thead>
                            <tr>
                                <th className="pl-6 w-8"></th>
                                <th>Date</th>
                                <th>Order #</th>
                                <th>Buyer</th>
                                <th>Items</th>
                                <th>Channel</th>
                                <th>Status</th>
                                <th className="text-right">Gross</th>
                                <th className="text-right">Cost</th>
                                <th className="text-right pr-6">Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="10" className="text-center py-8 text-lumina-muted">Loading...</td></tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr><td colSpan="10" className="text-center py-8 text-lumina-muted">No transactions found</td></tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const items = parseItems(order.items_summary);
                                    const isExpanded = expandedOrders[order.id];
                                    
                                    return (
                                        <React.Fragment key={order.id}>
                                            {/* Main Row */}
                                            <tr 
                                                onClick={() => toggleOrderExpand(order.id)}
                                                className="hover:bg-lumina-highlight/20 transition-colors border-b border-lumina-border/30 cursor-pointer group"
                                            >
                                                <td className="pl-6 text-center">
                                                    <span className={`inline-block transition-transform duration-300 text-lumina-gold ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                                </td>
                                                <td className="font-mono text-[11px] text-lumina-muted">{formatDate(order.order_date)}</td>
                                                <td className="font-mono text-[11px] text-lumina-gold font-bold">{order.order_number}</td>
                                                <td className="text-[11px] text-lumina-text">{order.customer_name}</td>
                                                <td className="text-[11px] text-lumina-muted">{items.length} item{items.length > 1 ? 's' : ''}</td>
                                                <td className="text-[11px]"><span className="badge-luxury badge-neutral whitespace-nowrap">{order.channel_id}</span></td>
                                                <td className="text-[11px]">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        order.status === 'completed' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-gray-700 text-gray-300'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="text-right font-mono text-emerald-400 font-bold text-[11px]">{formatRupiah(order.gross_amount || 0)}</td>
                                                <td className="text-right text-[11px] text-orange-400">{formatRupiah(order.total_cost || 0)}</td>
                                                <td className={`text-right pr-6 font-mono font-bold text-[11px] ${order.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRupiah(order.profit || 0)}</td>
                                            </tr>

                                            {/* Detail Row */}
                                            {isExpanded && (
                                                <tr className="bg-gray-900/50 hover:bg-gray-900/70 transition-colors">
                                                    <td></td>
                                                    <td colSpan="9" className="pl-6 pr-6 py-4">
                                                        <div className="space-y-3">
                                                            <h4 className="text-xs font-bold text-lumina-gold uppercase tracking-wider mb-3">Items</h4>
                                                            <div className="space-y-2">
                                                                {items.map((item, idx) => (
                                                                    <div key={idx} className="bg-gray-800/50 border border-lumina-border/40 rounded p-3 flex justify-between items-center">
                                                                        <div>
                                                                            <p className="text-[11px] font-bold text-lumina-text">SKU: <span className="text-lumina-gold">{item.sku}</span></p>
                                                                        </div>
                                                                        <span className="text-xs font-bold text-white">Qty: {item.qty}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}