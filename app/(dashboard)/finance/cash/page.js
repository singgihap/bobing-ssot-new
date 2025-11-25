'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, getAggregateFromServer, sum, where } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';
import CashTransactionsTable from '@/components/finance/CashTransactionsTable'; 

const CACHE_DURATION = 5 * 60 * 1000; // 5 menit

// Helpers for cache
const cacheKey = 'cash-transactions-cache';

const getCache = () => {
  try {
    const data = localStorage.getItem(cacheKey);
    if (!data) return null;
    const {now, transactions, metrics} = JSON.parse(data);
    if (Date.now() - now > CACHE_DURATION) return null;
    return {transactions, metrics};
  } catch {
    return null;
  }
};

const setCache = (transactions, metrics) => {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({ now: Date.now(), transactions, metrics })
  );
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
      // Fetch Transactions
      const qTrans = query(
        collection(db, "cash_transactions"),
        orderBy("date", "desc"),
        limit(200)
      );
      const snapTrans = await getDocs(qTrans);
      const transList = snapTrans.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Aggregated Metrics
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

    } catch (e) {
      console.error("Error fetching cash data:", e);
    } finally {
      setLoading(false);
    }
  };

  // KPI Card Reusable
  const KpiCard = ({ title, value, colorClass }) => (
    <div className={`card-luxury p-6 ${colorClass.startsWith('border-') ? colorClass : ''}`}>
      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">{title}</p>
      <h3 className={`text-3xl font-display font-bold ${colorClass.startsWith('text-') ? colorClass : 'text-text-primary'}`}>
        {loading ? <Skeleton className="h-8 w-32" /> : value}
      </h3>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Total Income (IN)" value={formatRupiah(metrics.totalIn)} colorClass="text-emerald-600 border-emerald-300/50" />
        <KpiCard title="Total Expense (OUT)" value={formatRupiah(metrics.totalOut)} colorClass="text-rose-600 border-rose-300/50" />
        <KpiCard title="Net Cash Balance" value={formatRupiah(metrics.netBalance)} colorClass="text-primary border-primary/50" />
      </div>
      <CashTransactionsTable 
        transactions={transactions} 
        loading={loading} 
        fetchData={fetchData} 
      />
    </div>
  );
}
