"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, getAggregateFromServer, sum, orderBy } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';
import { RefreshCw, TrendingUp, Layers, Archive, Wallet } from 'lucide-react';

const CACHE_KEY = 'lumina_balance_v2';
const CACHE_KEY_DASHBOARD = 'lumina_dash_master_v2';
const CACHE_DURATION = 30 * 60 * 1000;

export default function BalanceSheetPage() {
    const [assets, setAssets] = useState({ cash: 0, inventory: 0, receivable: 0, listCash: [] });
    const [liabilities, setLiabilities] = useState({ payable: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => { calculate(); }, []);

    const calculate = async (forceRefresh = false) => {
        setLoading(true);
        try {
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { assets: cAssets, liabilities: cLiabilities, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setAssets(cAssets); setLiabilities(cLiabilities); setLoading(false); return;
                    }
                }
            }

            const snapCash = await getDocs(query(collection(db, "cash_accounts"), orderBy("created_at")));
            let totalCash = 0; const listCash = [];
            snapCash.forEach(doc => { const d = doc.data(); totalCash += (d.balance || 0); listCash.push({ name: d.name, val: d.balance || 0 }); });

            let totalInv = 0;
            let inventorySource = 'fetch';
            if (typeof window !== 'undefined') {
                const dashCache = localStorage.getItem(CACHE_KEY_DASHBOARD);
                if (dashCache) {
                    try {
                        const { data, ts } = JSON.parse(dashCache);
                        if (Date.now() - ts < 3600000 && data.variants && data.stocks) {
                            const costMap = {}; data.variants.forEach(v => costMap[v.id] = v.cost || 0);
                            data.stocks.forEach(s => { if (s.qty > 0) totalInv += (s.qty * (costMap[s.variant_id] || 0)); });
                            inventorySource = 'cache';
                        }
                    } catch (e) {}
                }
            }

            if (inventorySource === 'fetch') {
                const [snapSnap, snapVar] = await Promise.all([getDocs(collection(db, "stock_snapshots")), getDocs(collection(db, "product_variants"))]);
                const costMap = {}; snapVar.forEach(d => costMap[d.id] = d.data().cost || 0);
                snapSnap.forEach(doc => { const d = doc.data(); if(d.qty > 0) totalInv += (d.qty * (costMap[d.variant_id] || 0)); });
            }

            const [snapPiutang, snapHutang] = await Promise.all([
                getAggregateFromServer(query(collection(db, "sales_orders"), where("payment_status", "==", "unpaid")), { totalUnpaid: sum('net_amount') }),
                getAggregateFromServer(query(collection(db, "purchase_orders"), where("payment_status", "==", "unpaid")), { totalUnpaid: sum('total_amount') })
            ]);

            const newAssets = { cash: totalCash, inventory: totalInv, receivable: snapPiutang.data().totalUnpaid || 0, listCash };
            const newLiabilities = { payable: snapHutang.data().totalUnpaid || 0 };

            setAssets(newAssets); setLiabilities(newLiabilities);
            if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify({ assets: newAssets, liabilities: newLiabilities, timestamp: Date.now() }));

        } catch(e) { console.error(e); toast.error("Gagal menghitung neraca"); } finally { setLoading(false); }
    };

    const totalAssets = assets.cash + assets.inventory + assets.receivable;
    const equity = totalAssets - liabilities.payable;

    return (
        <div className="max-w-6xl mx-auto space-y-6 fade-in pb-20">
            <div className="flex justify-end">
                <button onClick={() => calculate(true)} className="text-xs font-bold text-text-secondary flex items-center gap-2 hover:text-primary bg-white px-3 py-2 rounded-lg border border-border shadow-sm transition-all active:scale-95">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/> Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* --- ASSETS COLUMN --- */}
                <div className="bg-white border border-emerald-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="px-6 py-4 border-b border-emerald-100 bg-emerald-50/50 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-emerald-600"/>
                        <h3 className="font-bold text-emerald-800 text-sm uppercase tracking-wider">Aktiva (Assets)</h3>
                    </div>
                    
                    <div className="p-6 space-y-6 flex-1">
                        {/* Cash */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wide">
                                <Wallet className="w-3.5 h-3.5"/> Kas & Bank
                            </div>
                            <div className="pl-4 space-y-2 border-l-2 border-border">
                                {loading ? <p className="text-xs animate-pulse">Loading...</p> : assets.listCash.map((c, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-text-primary">{c.name}</span>
                                        <span className="font-mono font-medium">{formatRupiah(c.val)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 font-bold">
                                <span className="text-sm">Total Kas</span>
                                <span className="text-emerald-600">{formatRupiah(assets.cash)}</span>
                            </div>
                        </div>

                        {/* Inventory */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wide">
                                <Archive className="w-3.5 h-3.5"/> Persediaan
                            </div>
                            <div className="flex justify-between text-sm pl-4 border-l-2 border-border">
                                <span className="text-text-primary">Nilai Stok (HPP)</span>
                                <span className="font-mono font-bold text-blue-600">{formatRupiah(assets.inventory)}</span>
                            </div>
                        </div>

                        {/* Receivables */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wide">
                                <TrendingUp className="w-3.5 h-3.5"/> Piutang
                            </div>
                            <div className="flex justify-between text-sm pl-4 border-l-2 border-border">
                                <span className="text-text-primary">Piutang Usaha</span>
                                <span className="font-mono font-bold text-amber-600">{formatRupiah(assets.receivable)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                        <span className="font-bold text-emerald-900">TOTAL ASSETS</span>
                        <span className="font-extrabold text-emerald-700 text-xl font-mono">{formatRupiah(totalAssets)}</span>
                    </div>
                </div>

                {/* --- LIABILITIES & EQUITY COLUMN --- */}
                <div className="flex flex-col gap-6">
                    {/* LIABILITIES */}
                    <div className="bg-white border border-rose-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-rose-100 bg-rose-50/50 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-rose-600"/>
                            <h3 className="font-bold text-rose-800 text-sm uppercase tracking-wider">Kewajiban (Liabilities)</h3>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-text-primary">Hutang Usaha (PO)</span>
                                <span className="font-bold text-rose-600 font-mono">{formatRupiah(liabilities.payable)}</span>
                            </div>
                        </div>
                        <div className="px-6 py-3 bg-rose-50/50 border-t border-rose-100 flex justify-between items-center">
                            <span className="font-bold text-rose-900 text-sm">TOTAL LIABILITIES</span>
                            <span className="font-bold text-rose-700 text-lg font-mono">{formatRupiah(liabilities.payable)}</span>
                        </div>
                    </div>

                    {/* EQUITY */}
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden flex-1 flex flex-col justify-center">
                        <div className="relative z-10">
                            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-2">Ekuitas Pemilik (Equity)</p>
                            <h3 className="text-4xl font-display font-bold tracking-tight">
                                {loading ? '...' : formatRupiah(equity)}
                            </h3>
                            <div className="h-px bg-white/20 my-4 w-full"></div>
                            <div className="flex justify-between text-sm text-blue-100">
                                <span>Assets - Liabilities</span>
                                <span>Net Value</span>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-900/30 rounded-full blur-2xl -ml-10 -mb-10"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}