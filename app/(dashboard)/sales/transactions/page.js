'use client';
import React from 'react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';

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

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const q = query(
                collection(db, "sales_orders"), 
                orderBy("order_date", "desc"), 
                limit(500)
            );
            const snap = await getDocs(q);
            
            const ordersList = [];
            snap.forEach(d => {
                ordersList.push({
                    id: d.id,
                    ...d.data()
                });
            });
            setOrders(ordersList);
            console.log('Orders loaded:', ordersList.length);
        } catch(e) {
            console.error('Error fetching orders:', e);
        } finally {
            setLoading(false);
        }
    };

    // Filter orders
    const filteredOrders = orders.filter(order => {
        const matchChannel = filterChannel === 'all' || order.channel_id === filterChannel;
        const matchStatus = filterStatus === 'all' || order.status === filterStatus;
        const matchSearch = !searchQuery || 
            order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.items_summary?.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchDate = true;
        if(dateRange.from) {
            const orderDate = new Date(order.order_date.toDate ? order.order_date.toDate() : order.order_date);
            matchDate = orderDate >= new Date(dateRange.from);
        }
        if(dateRange.to) {
            const orderDate = new Date(order.order_date.toDate ? order.order_date.toDate() : order.order_date);
            matchDate = matchDate && orderDate <= new Date(dateRange.to);
        }
        
        return matchChannel && matchStatus && matchSearch && matchDate;
    });

    // Get unique values
    const channels = ['all', ...new Set(orders.map(o => o.channel_id).filter(Boolean))];
    const statuses = ['all', ...new Set(orders.map(o => o.status).filter(Boolean))];

    // Key metrics
    const metrics = {
        totalOrders: filteredOrders.length,
        totalRevenue: filteredOrders.reduce((sum, o) => sum + (o.gross_amount || 0), 0),
        totalCost: filteredOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0),
        totalProfit: filteredOrders.reduce((sum, o) => sum + (o.profit || 0), 0),
        avgOrderValue: filteredOrders.length > 0 ? filteredOrders.reduce((sum, o) => sum + (o.gross_amount || 0), 0) / filteredOrders.length : 0
    };

    const profitMargin = metrics.totalRevenue > 0 ? ((metrics.totalProfit / metrics.totalRevenue) * 100).toFixed(1) : 0;

    // Format date
    const formatDate = (date) => {
        if(!date) return '-';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch(e) {
            return '-';
        }
    };

    // ✅ Toggle function untuk expand/collapse
    const toggleOrderExpand = (orderId) => {
        setExpandedOrders(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    return (
        <div className="max-w-full mx-auto space-y-8 fade-in pb-20 px-4">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-display font-bold text-lumina-text">Transactions History</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Track all sales orders from imports and manual entries.</p>
                </div>
                <button onClick={fetchOrders} className="btn-gold text-sm">↻ Refresh</button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Total Orders</p>
                    <h3 className="text-3xl font-display font-bold text-lumina-gold">{metrics.totalOrders}</h3>
                    <p className="text-xs text-lumina-muted mt-2">orders</p>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Revenue</p>
                    <h3 className="text-2xl font-display font-bold text-emerald-400">{formatRupiah(metrics.totalRevenue)}</h3>
                    <p className="text-xs text-lumina-muted mt-2">gross sales</p>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Total Cost</p>
                    <h3 className="text-2xl font-display font-bold text-orange-400">{formatRupiah(metrics.totalCost)}</h3>
                    <p className="text-xs text-lumina-muted mt-2">total HPP</p>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Profit</p>
                    <h3 className="text-2xl font-display font-bold text-blue-400">{formatRupiah(metrics.totalProfit)}</h3>
                    <p className="text-xs text-lumina-muted mt-2">{profitMargin}% margin</p>
                </div>
                <div className="card-luxury p-6">
                    <p className="text-xs font-bold text-lumina-muted uppercase tracking-wider mb-2">Avg Order Value</p>
                    <h3 className="text-2xl font-display font-bold text-purple-400">{formatRupiah(metrics.avgOrderValue)}</h3>
                    <p className="text-xs text-lumina-muted mt-2">per order</p>
                </div>
            </div>

            {/* Filters */}
            <div className="card-luxury p-6 space-y-4">
                <h4 className="font-semibold text-lumina-text">Filters</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">Channel</label>
                        <select 
                            value={filterChannel}
                            onChange={(e) => setFilterChannel(e.target.value)}
                            className="input-luxury w-full text-xs"
                        >
                            {channels.map(c => (
                                <option key={c} value={c}>
                                    {c === 'all' ? 'All Channels' : c}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">Status</label>
                        <select 
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="input-luxury w-full text-xs"
                        >
                            {statuses.map(s => (
                                <option key={s} value={s}>
                                    {s === 'all' ? 'All Status' : s}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">From Date</label>
                        <input 
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                            className="input-luxury w-full text-xs"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">To Date</label>
                        <input 
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                            className="input-luxury w-full text-xs"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">Search</label>
                        <input 
                            type="text"
                            placeholder="Order # or buyer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-luxury w-full text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* Transactions Table - UPDATED */}
            <div className="card-luxury overflow-hidden">
                <div className="px-6 py-4 border-b border-lumina-border bg-lumina-surface/50 flex justify-between items-center">
                    <h3 className="font-bold text-lumina-text text-sm uppercase tracking-wider">Sales Orders</h3>
                    <div className="text-[10px] font-medium text-lumina-muted bg-lumina-highlight px-2 py-1 rounded">
                        {filteredOrders.length} of {orders.length} orders
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
                                <th className="text-right">Net</th>
                                <th className="text-right pr-6">Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="11" className="text-center py-8 text-lumina-muted">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="text-center py-8 text-lumina-muted">
                                        No transactions found
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const profitMarginItem = order.gross_amount > 0 ? ((order.profit / order.gross_amount) * 100).toFixed(0) : 0;
                                    // ✅ Parse items dari string "SKU1(qty1), SKU2(qty2)" format
                                    const parseItems = (itemsSummary) => {
                                        if (!itemsSummary) return [];
                                        const items = itemsSummary.split(',').map(item => {
                                            const match = item.trim().match(/^(.+?)\((\d+)\)$/);
                                            return {
                                                sku: match ? match[1] : item.trim(),
                                                qty: match ? parseInt(match[2]) : 1
                                            };
                                        });
                                        return items;
                                    };
                                    
                                    const items = parseItems(order.items_summary);
                                    const isExpanded = expandedOrders[order.id];
                                    
                                    return (
                                        <React.Fragment key={order.id}>
                                            {/* ✅ Main Row - Clickable */}
                                            <tr 
                                                onClick={() => toggleOrderExpand(order.id)}
                                                className="hover:bg-lumina-highlight/20 transition-colors border-b border-lumina-border/30 cursor-pointer group"
                                            >
                                                <td className="pl-6 text-center">
                                                    <span className={`inline-block transition-transform duration-300 text-lumina-gold ${isExpanded ? 'rotate-180' : ''}`}>
                                                        ▼
                                                    </span>
                                                </td>
                                                <td className="font-mono text-[11px] text-lumina-muted">{formatDate(order.order_date)}</td>
                                                <td className="font-mono text-[11px] text-lumina-gold font-bold">{order.order_number}</td>
                                                <td className="text-[11px] text-lumina-text">{order.customer_name}</td>
                                                <td className="text-[11px] text-lumina-muted group-hover:text-lumina-gold transition-colors">
                                                    {items.length} item{items.length > 1 ? 's' : ''}
                                                </td>
                                                <td className="text-[11px]">
                                                    <span className="badge-luxury badge-neutral whitespace-nowrap">
                                                        {order.channel_id}
                                                    </span>
                                                </td>
                                                <td className="text-[11px]">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        order.status === 'to_process' ? 'bg-yellow-900/30 text-yellow-300' :
                                                        order.status === 'processing' ? 'bg-blue-900/30 text-blue-300' :
                                                        order.status === 'shipped' ? 'bg-green-900/30 text-green-300' :
                                                        order.status === 'delivered' ? 'bg-emerald-900/30 text-emerald-300' :
                                                        'bg-gray-700 text-gray-300'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="text-right font-mono text-emerald-400 font-bold text-[11px]">
                                                    {formatRupiah(order.gross_amount || 0)}
                                                </td>
                                                <td className="text-right text-[11px] text-orange-400">{formatRupiah(order.total_cost || 0)}</td>
                                                <td className="text-right text-[11px] text-blue-300">{formatRupiah(order.net_amount || 0)}</td>
                                                <td className="text-right pr-6">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-mono font-bold text-[11px] ${order.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {formatRupiah(order.profit || 0)}
                                                        </span>
                                                        <span className={`text-[10px] ${order.profit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                            {profitMarginItem}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ✅ Detail Row - Items List */}
                                            {isExpanded && (
                                                <tr className="bg-gray-900/50 hover:bg-gray-900/70 transition-colors">
                                                    <td></td>
                                                    <td colSpan="10" className="pl-6 pr-6 py-4">
                                                        <div className="space-y-3">
                                                            <h4 className="text-xs font-bold text-lumina-gold uppercase tracking-wider mb-3">
                                                                Order Items ({items.length})
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {items.map((item, idx) => (
                                                                    <div 
                                                                        key={idx}
                                                                        className="bg-gray-800/50 border border-lumina-border/40 rounded p-3 flex justify-between items-center hover:border-lumina-gold/50 transition-colors"
                                                                    >
                                                                        <div className="flex-1">
                                                                            <p className="text-[11px] font-bold text-lumina-text">
                                                                                SKU: <span className="text-lumina-gold">{item.sku}</span>
                                                                            </p>
                                                                            <p className="text-[10px] text-lumina-muted mt-1">
                                                                                Quantity: <span className="text-lumina-text font-semibold">{item.qty}</span>
                                                                            </p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="inline-block bg-lumina-gold/20 text-lumina-gold px-3 py-1 rounded text-[10px] font-bold">
                                                                                ×{item.qty}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Additional Order Details */}
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-lumina-border/30">
                                                                <div className="bg-gray-800/50 rounded p-2">
                                                                    <p className="text-[9px] text-lumina-muted uppercase font-bold">Courier</p>
                                                                    <p className="text-[11px] text-lumina-text mt-1">{order.courier || 'N/A'}</p>
                                                                </div>
                                                                <div className="bg-gray-800/50 rounded p-2">
                                                                    <p className="text-[9px] text-lumina-muted uppercase font-bold">Weight</p>
                                                                    <p className="text-[11px] text-lumina-text mt-1">{order.total_weight_g}g</p>
                                                                </div>
                                                                <div className="bg-gray-800/50 rounded p-2">
                                                                    <p className="text-[9px] text-lumina-muted uppercase font-bold">Payment Status</p>
                                                                    <p className="text-[11px] text-emerald-400 mt-1 font-semibold">{order.payment_status}</p>
                                                                </div>
                                                                <div className="bg-gray-800/50 rounded p-2">
                                                                    <p className="text-[9px] text-lumina-muted uppercase font-bold">Tracking</p>
                                                                    <p className="text-[11px] text-lumina-text mt-1">{order.tracking_number || 'Pending'}</p>
                                                                </div>
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