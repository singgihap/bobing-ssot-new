'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, getAggregateFromServer, sum, where } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';
import CashTransactionsTable from '@/components/finance/CashTransactionsTable'; 

// UI
import { ArrowUpCircle, ArrowDownCircle, Wallet, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const CACHE_DURATION = 5 * 60 * 1000;
const cacheKey = 'cash-transactions-cache';

const getCache = () => {
  try {
    const data = localStorage.getItem(cacheKey);
    if (!data) return null;
    const {now, transactions, metrics} = JSON.parse(data);
    if (Date.now() - now > CACHE_DURATION) return null;
    return {transactions, metrics};
  } catch { return null; }
};

const setCache = (transactions, metrics) => {
  localStorage.setItem(cacheKey, JSON.stringify({ now: Date.now(), transactions, metrics }));
};

export default function CashTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [metrics, setMetrics] = useState({ totalIn: 0, totalOut: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCache();
    if (cached) {
      setTransactions(cached.transactions);
      setMetrics(cached.metrics);
      setLoading(false);
    } else {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const qTrans = query(collection(db, "cash_transactions"), orderBy("date", "desc"), limit(200));
      const snapTrans = await getDocs(qTrans);
      const transList = snapTrans.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const qAgg = collection(db, "cash_transactions");
      const aggSnap = await getAggregateFromServer(qAgg, {
        totalIn: sum('amount', where('type', '==', 'IN')),
        totalOut: sum('amount', where('type', '==', 'OUT')),
      });
      const totalIn = aggSnap.data().totalIn || 0;
      const totalOut = aggSnap.data().totalOut || 0;
      const netBalance = totalIn - totalOut;

      setTransactions(transList);
      setMetrics({ totalIn, totalOut, netBalance });
      setCache(transList, { totalIn, totalOut, netBalance });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // Modern Metric Card
  const MetricCard = ({ title, value, icon: Icon, color, delay }) => {
      const colors = {
          emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
          rose: 'text-rose-600 bg-rose-50 border-rose-100',
          blue: 'text-blue-600 bg-blue-50 border-blue-100',
      };
      const theme = colors[color] || colors.blue;

      return (
        <motion.div 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay }}
            className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between"
        >
            <div>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">{title}</p>
                <h3 className={`text-2xl font-display font-bold ${theme.split(' ')[0]}`}>
                    {loading ? <Skeleton className="h-8 w-32" /> : value}
                </h3>
            </div>
            <div className={`p-3 rounded-xl border ${theme}`}>
                <Icon className="w-6 h-6" />
            </div>
        </motion.div>
      );
  };

  return (
    <div className="space-y-8 fade-in pb-20">
      <div className="flex justify-end">
          <button onClick={fetchData} className="text-xs font-bold text-text-secondary flex items-center gap-2 hover:text-primary bg-white px-3 py-2 rounded-lg border border-border shadow-sm transition-all active:scale-95">
              <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/> Refresh Data
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Total Income (IN)" value={formatRupiah(metrics.totalIn)} color="emerald" icon={ArrowUpCircle} delay={0.1} />
        <MetricCard title="Total Expense (OUT)" value={formatRupiah(metrics.totalOut)} color="rose" icon={ArrowDownCircle} delay={0.2} />
        <MetricCard title="Net Cash Balance" value={formatRupiah(metrics.netBalance)} color="blue" icon={Wallet} delay={0.3} />
      </div>

      {/* Table Container - memastikan table komponen external terlihat bagus */}
      <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-white">
          <CashTransactionsTable transactions={transactions} loading={loading} fetchData={fetchData} />
      </div>
    </div>
  );
}