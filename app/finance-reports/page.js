// app/finance-reports/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';

export default function ReportPLPage() {
    const [data, setData] = useState({ revenue: 0, cogs: 0, expenses: 0, details: {} });
    const [loading, setLoading] = useState(false);
    const [range, setRange] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0] 
    });

    const generateReport = async () => {
        setLoading(true);
        const start = new Date(range.start); start.setHours(0,0,0,0);
        const end = new Date(range.end); end.setHours(23,59,59,999);

        try {
            const qSales = query(collection(db, "sales_orders"), where("order_date", ">=", start), where("order_date", "<=", end));
            const snapSales = await getDocs(qSales);
            let rev = 0, cogs = 0;
            snapSales.forEach(d => { const s = d.data(); rev += (s.net_amount || 0); cogs += (s.total_cost || 0); });

            const qExp = query(collection(db, "cash_transactions"), where("date", ">=", start), where("date", "<=", end), where("type", "==", "out"));
            const snapExp = await getDocs(qExp);
            let expTotal = 0; const expDet = {};
            const exclude = ['pembelian', 'transfer', 'prive']; 
            snapExp.forEach(d => {
                const t = d.data(); const cat = (t.category || 'Lainnya').toLowerCase();
                if(!exclude.includes(cat)) { expTotal += t.amount; expDet[cat] = (expDet[cat] || 0) + t.amount; }
            });
            setData({ revenue: rev, cogs: cogs, expenses: expTotal, details: expDet });
        } catch(e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { generateReport(); }, []);

    const gross = data.revenue - data.cogs;
    const net = gross - data.expenses;
    const margin = data.revenue > 0 ? (net / data.revenue) * 100 : 0;

    return (
        <div className="max-w-3xl mx-auto space-y-8 fade-in pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Profit & Loss</h2>
                    <p className="text-sm text-gray-500">Financial performance report.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <input type="date" className="text-sm border-none bg-transparent focus:ring-0 text-gray-600" value={range.start} onChange={e=>setRange({...range, start:e.target.value})} />
                    <span className="self-center text-gray-300">-</span>
                    <input type="date" className="text-sm border-none bg-transparent focus:ring-0 text-gray-600" value={range.end} onChange={e=>setRange({...range, end:e.target.value})} />
                    <button onClick={generateReport} className="bg-brand-600 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-brand-700">{loading ? '...' : 'Go'}</button>
                </div>
            </div>

            <div className="card p-8 space-y-6 border-t-4 border-t-brand-500">
                {/* REVENUE */}
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Revenue</h3>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">Net Sales</span>
                        <span className="font-bold text-lg text-gray-900">{formatRupiah(data.revenue)}</span>
                    </div>
                </div>

                {/* COGS */}
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Cost of Goods Sold</h3>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">HPP Product</span>
                        <span className="font-bold text-lg text-red-500">({formatRupiah(data.cogs)})</span>
                    </div>
                </div>

                {/* GROSS PROFIT */}
                <div className="bg-brand-50/50 p-4 rounded-xl border border-brand-100 flex justify-between items-center">
                    <span className="font-bold text-brand-900 text-sm uppercase tracking-wide">Gross Profit</span>
                    <span className="font-extrabold text-xl text-brand-700">{formatRupiah(gross)}</span>
                </div>

                {/* EXPENSES */}
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Operating Expenses</h3>
                    <div className="space-y-2 pl-2 mb-4">
                        {Object.entries(data.details).map(([k, v]) => (
                            <div key={k} className="flex justify-between text-sm">
                                <span className="capitalize text-gray-600">{k}</span>
                                <span className="font-mono text-gray-800">{formatRupiah(v)}</span>
                            </div>
                        ))}
                        {data.expenses === 0 && <p className="text-sm text-gray-400 italic">No expenses recorded.</p>}
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                        <span className="font-bold text-gray-700 text-sm">Total Expenses</span>
                        <span className="font-bold text-red-500">({formatRupiah(data.expenses)})</span>
                    </div>
                </div>

                {/* NET PROFIT */}
                <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                        <span className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Net Profit</span>
                        <span className={`text-3xl font-extrabold tracking-tight ${net < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatRupiah(net)}</span>
                    </div>
                    <div className="relative z-10 text-right">
                        <span className="block text-gray-400 text-xs">Net Margin</span>
                        <span className={`text-xl font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{margin.toFixed(1)}%</span>
                    </div>
                    <div className="absolute -right-6 -bottom-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                </div>
            </div>
        </div>
    );
}