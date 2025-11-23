// app/finance-balance/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';

export default function BalanceSheetPage() {
    const [assets, setAssets] = useState({ cash: 0, inventory: 0, receivable: 0, listCash: [] });
    const [liabilities, setLiabilities] = useState({ payable: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => { calculate(); }, []);

    const calculate = async () => {
        setLoading(true);
        try {
            const snapCash = await getDocs(collection(db, "cash_accounts"));
            let totalCash = 0; const listCash = [];
            snapCash.forEach(doc => { const d = doc.data(); totalCash += (d.balance || 0); listCash.push({ name: d.name, val: d.balance || 0 }); });

            const [snapSnap, snapVar] = await Promise.all([getDocs(collection(db, "stock_snapshots")), getDocs(collection(db, "product_variants"))]);
            const costMap = {}; snapVar.forEach(d => costMap[d.id] = d.data().cost || 0);
            let totalInv = 0; snapSnap.forEach(doc => { const d = doc.data(); if(d.qty > 0) totalInv += (d.qty * (costMap[d.variant_id] || 0)); });

            const snapPiutang = await getDocs(query(collection(db, "sales_orders"), where("payment_status", "==", "unpaid")));
            let totalPiutang = 0; snapPiutang.forEach(d => totalPiutang += (d.data().net_amount || 0));

            const snapHutang = await getDocs(query(collection(db, "purchase_orders"), where("payment_status", "==", "unpaid")));
            let totalHutang = 0; snapHutang.forEach(d => totalHutang += (d.data().total_amount || 0));

            setAssets({ cash: totalCash, inventory: totalInv, receivable: totalPiutang, listCash });
            setLiabilities({ payable: totalHutang });
        } catch(e) { console.error(e); } finally { setLoading(false); }
    };

    const totalAssets = assets.cash + assets.inventory + assets.receivable;
    const equity = totalAssets - liabilities.payable;

    return (
        <div className="max-w-6xl mx-auto space-y-8 fade-in pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Balance Sheet</h2>
                    <p className="text-sm text-gray-500">Real-time financial position.</p>
                </div>
                <button onClick={calculate} className="btn-secondary text-xs">Refresh</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ASSETS */}
                <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-emerald-50/50">
                        <h3 className="font-bold text-emerald-800 uppercase tracking-wider text-xs">Assets (Harta)</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Cash & Bank</p>
                            <div className="space-y-2 pl-3 border-l-2 border-gray-100">
                                {assets.listCash.map((c, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{c.name}</span>
                                        <span className="font-mono font-medium">{formatRupiah(c.val)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-gray-200 font-bold text-gray-700">
                                <span>Total Cash</span><span>{formatRupiah(assets.cash)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Inventory</p>
                            <div className="flex justify-between items-center pl-3 border-l-2 border-blue-100">
                                <span className="text-sm text-gray-600">Stock Value (At Cost)</span>
                                <span className="font-bold text-gray-800">{formatRupiah(assets.inventory)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Receivables</p>
                            <div className="flex justify-between items-center pl-3 border-l-2 border-amber-100">
                                <span className="text-sm text-gray-600">Unpaid Sales</span>
                                <span className="font-bold text-gray-800">{formatRupiah(assets.receivable)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                        <span className="font-bold text-gray-800">TOTAL ASSETS</span>
                        <span className="font-extrabold text-emerald-600 text-xl">{formatRupiah(totalAssets)}</span>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* LIABILITIES */}
                    <div className="card p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-red-50/50">
                            <h3 className="font-bold text-red-800 uppercase tracking-wider text-xs">Liabilities (Hutang)</h3>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-between items-center pl-3 border-l-2 border-red-100">
                                <span className="text-sm text-gray-600">Accounts Payable (PO)</span>
                                <span className="font-bold text-red-600">{formatRupiah(liabilities.payable)}</span>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                            <span className="font-bold text-gray-800">TOTAL LIABILITIES</span>
                            <span className="font-bold text-red-600 text-lg">{formatRupiah(liabilities.payable)}</span>
                        </div>
                    </div>

                    {/* EQUITY */}
                    <div className="card p-6 bg-gray-900 text-white text-center relative overflow-hidden border-none">
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Owners Equity</p>
                        <h3 className={`text-3xl font-extrabold tracking-tight ${equity >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {formatRupiah(equity)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-2">Assets - Liabilities</p>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}