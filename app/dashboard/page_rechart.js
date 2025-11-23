'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChannelPerformanceIcon, DailySalesTrendIcon, OrderStatusIcon, PaymentStatusIcon } from '@/components/DashboardIcons';

export default function DashboardPage() {
  const [period, setPeriod] = useState('month');
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    netProfit: 0,
    liquidCash: 0,
    inventoryValue: 0,
    transactionCount: 0
  });

  // Priority 1 - Quick Wins State
  const [channelPerformance, setChannelPerformance] = useState([]);
  const [dailySalesTrend, setDailySalesTrend] = useState([]);
  const [orderStatusPipeline, setOrderStatusPipeline] = useState([]);
  const [paymentStatusOverview, setPaymentStatusOverview] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch semua sales orders dan hitung metrics
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const salesOrdersRef = collection(db, 'sales_orders');
      const snapshot = await getDocs(salesOrdersRef);

      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // ========================================
      // 1. CHANNEL PERFORMANCE
      // ========================================
      const channelMetrics = {};
      let totalRevenue = 0;
      let totalProfit = 0;

      orders.forEach(order => {
        const channel = order.channel_id || 'Unknown';
        if (!channelMetrics[channel]) {
          channelMetrics[channel] = {
            name: channel.charAt(0).toUpperCase() + channel.slice(1),
            orders: 0,
            revenue: 0,
            profit: 0
          };
        }
        channelMetrics[channel].orders += 1;
        channelMetrics[channel].revenue += order.gross_amount || 0;
        channelMetrics[channel].profit += order.profit || 0;
        totalRevenue += order.gross_amount || 0;
        totalProfit += order.profit || 0;
      });

      const channelData = Object.values(channelMetrics).sort((a, b) => b.revenue - a.revenue);
      setChannelPerformance(channelData);

      // ========================================
      // 2. DAILY SALES TREND
      // ========================================
      const today = new Date();
      const dailyData = {};

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyData[dateStr] = { 
          dateStr,
          date: date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
          revenue: 0, 
          profit: 0, 
          orders: 0 
        };
      }

      orders.forEach(order => {
        let orderDate;
        if (order.order_date?.toDate) {
          orderDate = order.order_date.toDate();
        } else if (order.order_date instanceof Date) {
          orderDate = order.order_date;
        } else {
          orderDate = new Date(order.order_date);
        }
        
        const dateStr = orderDate.toISOString().split('T')[0];
        if (dailyData[dateStr]) {
          dailyData[dateStr].revenue += order.gross_amount || 0;
          dailyData[dateStr].profit += order.profit || 0;
          dailyData[dateStr].orders += 1;
        }
      });

      const dailyTrendData = Object.values(dailyData);
      setDailySalesTrend(dailyTrendData);

      // ========================================
      // 3. ORDER STATUS PIPELINE
      // ========================================
      const statusCounts = {
        to_process: 0,
        processing: 0,
        shipped: 0,
        delivered: 0
      };

      orders.forEach(order => {
        const status = order.status?.toLowerCase() || 'to_process';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });

      const totalOrders = orders.length;
      const statusData = [
        {
          name: 'To Process',
          value: statusCounts.to_process,
          percentage: totalOrders > 0 ? ((statusCounts.to_process / totalOrders) * 100).toFixed(1) : 0,
          color: '#EF4444'
        },
        {
          name: 'Processing',
          value: statusCounts.processing,
          percentage: totalOrders > 0 ? ((statusCounts.processing / totalOrders) * 100).toFixed(1) : 0,
          color: '#F59E0B'
        },
        {
          name: 'Shipped',
          value: statusCounts.shipped,
          percentage: totalOrders > 0 ? ((statusCounts.shipped / totalOrders) * 100).toFixed(1) : 0,
          color: '#3B82F6'
        },
        {
          name: 'Delivered',
          value: statusCounts.delivered,
          percentage: totalOrders > 0 ? ((statusCounts.delivered / totalOrders) * 100).toFixed(1) : 0,
          color: '#10B981'
        }
      ];
      setOrderStatusPipeline(statusData);

      // ========================================
      // 4. PAYMENT STATUS OVERVIEW
      // ========================================
      const paymentStatus = {
        paid: 0,
        pending: 0,
        failed: 0
      };

      orders.forEach(order => {
        const status = order.payment_status?.toLowerCase() || 'pending';
        if (paymentStatus.hasOwnProperty(status)) {
          paymentStatus[status]++;
        }
      });

      const paymentData = [
        {
          name: 'Paid',
          value: paymentStatus.paid,
          color: '#10B981'
        },
        {
          name: 'Pending',
          value: paymentStatus.pending,
          color: '#F59E0B'
        },
        {
          name: 'Failed',
          value: paymentStatus.failed,
          color: '#EF4444'
        }
      ].filter(item => item.value > 0);

      setPaymentStatusOverview(paymentData);

      // Update main metrics
      setMetrics({
        totalRevenue,
        netProfit: totalProfit,
        liquidCash: 0,
        inventoryValue: 0,
        transactionCount: orders.length
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* ========== HEADER ========== */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Executive Dashboard</h1>
          <p className="text-slate-400">Real-time business intelligence & analytics.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg hover:bg-slate-700 transition"
        >
          <option value="day">Hari Ini</option>
          <option value="month">Bulan Ini</option>
          <option value="lastMonth">Bulan Lalu</option>
        </select>
      </div>

      {/* ========== TOP METRICS (Existing) ========== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p className="text-slate-400 text-sm font-semibold mb-2">TOTAL REVENUE</p>
          <h2 className="text-2xl font-bold text-white mb-1">
            Rp {metrics.totalRevenue.toLocaleString('id-ID')}
          </h2>
          <p className="text-slate-500 text-sm">{metrics.transactionCount} Transactions</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p className="text-slate-400 text-sm font-semibold mb-2">NET PROFIT</p>
          <h2 className="text-2xl font-bold text-white mb-1">
            Rp {metrics.netProfit.toLocaleString('id-ID')}
          </h2>
          <p className="text-slate-500 text-sm">
            Margin {metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}%
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p className="text-slate-400 text-sm font-semibold mb-2">LIQUID CASH</p>
          <h2 className="text-2xl font-bold text-white mb-1">Rp 0</h2>
          <p className="text-slate-500 text-sm">All Wallets</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p className="text-slate-400 text-sm font-semibold mb-2">INVENTORY VALUE</p>
          <h2 className="text-2xl font-bold text-white mb-1">Rp 551.674.700</h2>
          <p className="text-slate-500 text-sm">Total Assets (HPP)</p>
        </div>
      </div>

      {/* ========== PRIORITY 1 QUICK WINS - ROW 1 ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Channel Performance */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ChannelPerformanceIcon />
            <span>Channel Performance</span>
          </h3>
          {loading ? (
            <div className="text-slate-400 text-center py-8">Loading...</div>
          ) : channelPerformance.length > 0 ? (
            <div className="space-y-4">
                            {channelPerformance.map((channel, idx) => (
                <div key={idx} className="bg-slate-800 rounded-lg p-4 hover:bg-slate-700/80 transition">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-white">{channel.name}</h4>
                    <span className="text-yellow-400 font-bold">Rp {channel.revenue.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>{channel.orders} Pesanan</span>
                    <span className="text-green-400">Profit: Rp {channel.profit.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-center py-8">Belum ada data</div>
          )}
        </div>

        {/* Daily Sales Trend */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <DailySalesTrendIcon />
            <span>Daily Sales Trend</span>
          </h3>
          {loading ? (
            <div className="text-slate-400 text-center py-8">Loading...</div>
          ) : dailySalesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailySalesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    border: '1px solid #475569', 
                    borderRadius: '8px', 
                    color: '#fff' 
                  }} 
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#F4B942" 
                  strokeWidth={2} 
                  name="Revenue" 
                  dot={{ fill: '#F4B942', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10B981" 
                  strokeWidth={2} 
                  name="Profit"
                  dot={{ fill: '#10B981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-slate-400 text-center py-8">Belum ada data</div>
          )}
        </div>
      </div>

      {/* ========== PRIORITY 1 QUICK WINS - ROW 2 ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Order Status Pipeline */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <OrderStatusIcon />
            <span>Order Status Pipeline</span>
          </h3>
          {loading ? (
            <div className="text-slate-400 text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-4">
              {orderStatusPipeline.map((status, idx) => (
                <div key={idx} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: status.color }}
                      ></div>
                      <h4 className="font-semibold text-white">{status.name}</h4>
                    </div>
                    <span className="text-lg font-bold text-white">{status.value}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${status.percentage}%`,
                        backgroundColor: status.color
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{status.percentage}% dari total pesanan</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Status Overview */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <PaymentStatusIcon />
            <span>Payment Status Overview</span>
          </h3>
          {loading ? (
            <div className="text-slate-400 text-center py-8">Loading...</div>
          ) : paymentStatusOverview.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={paymentStatusOverview}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {paymentStatusOverview.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    border: '1px solid #475569', 
                    borderRadius: '8px', 
                    color: '#fff' 
                  }}
                  formatter={(value) => `${value} pesanan`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-slate-400 text-center py-8">Belum ada data pembayaran</div>
          )}
        </div>
      </div>

      {/* ========== EXISTING SECTIONS (Performance Trend & Channel Mix) ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Performance Trend - render existing component */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Performance Trend</h3>
          {/* Add your existing PerformanceTrend component here if available */}
        </div>

        {/* Channel Mix - render existing component */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Channel Mix</h3>
          {/* Add your existing ChannelMix component here if available */}
        </div>
      </div>

      {/* ========== BOTTOM SECTIONS (Top Products, Low Stock, Recent Sales) ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Products */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Top Products</h3>
          {/* Add your existing TopProducts component here */}
        </div>

        {/* Low Stock */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Low Stock</h3>
          {/* Add your existing LowStock component here */}
        </div>

        {/* Recent Sales */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Recent Sales</h3>
          {/* Add your existing RecentSales component here */}
        </div>
      </div>
    </div>
  );
}

