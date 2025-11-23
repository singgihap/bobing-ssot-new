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
                    <h2 className="text-2xl font-display font-bold text-lumina-text tracking-tight">Balance Sheet</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Real-time financial position snapshot.</p>
                </div>
                <button onClick={calculate} className="btn-ghost-dark text-xs">Refresh Data</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ASSETS */}
                <div className="card-luxury overflow-hidden">
                    <div className="px-6 py-4 border-b border-emerald-900/30 bg-emerald-900/10">
                        <h3 className="font-bold text-emerald-400 uppercase tracking-wider text-xs">Assets (Harta)</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <p className="text-xs font-bold text-lumina-muted uppercase mb-2 tracking-wide">Cash & Bank</p>
                            <div className="space-y-2 pl-3 border-l-2 border-lumina-border">
                                {assets.listCash.map((c, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-lumina-text opacity-80">{c.name}</span>
                                        <span className="font-mono font-medium text-lumina-text">{formatRupiah(c.val)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-lumina-border font-bold text-lumina-text">
                                <span>Total Cash</span><span className="text-emerald-400">{formatRupiah(assets.cash)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-lumina-muted uppercase mb-2 tracking-wide">Inventory</p>
                            <div className="flex justify-between items-center pl-3 border-l-2 border-blue-500/30">
                                <span className="text-sm text-lumina-text opacity-80">Stock Value (At Cost)</span>
                                <span className="font-bold text-blue-400 font-mono">{formatRupiah(assets.inventory)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-lumina-muted uppercase mb-2 tracking-wide">Receivables</p>
                            <div className="flex justify-between items-center pl-3 border-l-2 border-amber-500/30">
                                <span className="text-sm text-lumina-text opacity-80">Unpaid Sales</span>
                                <span className="font-bold text-amber-400 font-mono">{formatRupiah(assets.receivable)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-lumina-surface border-t border-lumina-border flex justify-between items-center">
                        <span className="font-bold text-lumina-text">TOTAL ASSETS</span>
                        <span className="font-extrabold text-emerald-500 text-xl font-mono">{formatRupiah(totalAssets)}</span>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* LIABILITIES */}
                    <div className="card-luxury overflow-hidden">
                        <div className="px-6 py-4 border-b border-rose-900/30 bg-rose-900/10">
                            <h3 className="font-bold text-rose-400 uppercase tracking-wider text-xs">Liabilities (Hutang)</h3>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-between items-center pl-3 border-l-2 border-rose-500/30">
                                <span className="text-sm text-lumina-text opacity-80">Accounts Payable (PO)</span>
                                <span className="font-bold text-rose-400 font-mono">{formatRupiah(liabilities.payable)}</span>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-lumina-surface border-t border-lumina-border flex justify-between items-center">
                            <span className="font-bold text-lumina-text">TOTAL LIABILITIES</span>
                            <span className="font-bold text-rose-500 text-lg font-mono">{formatRupiah(liabilities.payable)}</span>
                        </div>
                    </div>

                    {/* EQUITY */}
                    <div className="card-luxury p-6 bg-gradient-to-br from-lumina-surface to-lumina-highlight text-center relative overflow-hidden border-none shadow-2xl">
                        <div className="relative z-10">
                            <p className="text-xs text-lumina-muted uppercase tracking-widest mb-2 font-bold">Owners Equity</p>
                            <h3 className={`text-3xl font-display font-extrabold tracking-tight ${equity >= 0 ? 'text-white' : 'text-rose-400'}`}>
                                {formatRupiah(equity)}
                            </h3>
                            <p className="text-[10px] text-lumina-muted mt-2 opacity-70">Assets - Liabilities</p>
                        </div>
                        {/* Decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-lumina-gold/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}