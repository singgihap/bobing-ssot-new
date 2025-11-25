"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, getAggregateFromServer, sum, orderBy } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_KEY = 'lumina_balance_v2';
const CACHE_KEY_DASHBOARD = 'lumina_dash_master_v2'; // Reuse cache dashboard untuk inventory
const CACHE_DURATION = 30 * 60 * 1000; // 30 Menit (Data Neraca cukup stabil)

export default function BalanceSheetPage() {
    const [assets, setAssets] = useState({ cash: 0, inventory: 0, receivable: 0, listCash: [] });
    const [liabilities, setLiabilities] = useState({ payable: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => { 
        calculate(); 
    }, []);

    const calculate = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache LocalStorage
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { assets: cAssets, liabilities: cLiabilities, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setAssets(cAssets);
                        setLiabilities(cLiabilities);
                        setLoading(false);
                        return;
                    }
                }
            }

            // 2. Fetch Data (Optimized)
            
            // A. Cash (Kas & Bank) - Tetap fetch docs karena butuh rincian list nama akun
            // Biaya: Jumlah akun kas (biasanya sedikit, < 20)
            const snapCash = await getDocs(query(collection(db, "cash_accounts"), orderBy("created_at")));
            let totalCash = 0; 
            const listCash = [];
            snapCash.forEach(doc => { 
                const d = doc.data(); 
                totalCash += (d.balance || 0); 
                listCash.push({ name: d.name, val: d.balance || 0 }); 
            });

            // B. Inventory (HPP Aset) - Smart Reuse Cache
            let totalInv = 0;
            let inventorySource = 'fetch'; // 'cache' or 'fetch'

            if (typeof window !== 'undefined') {
                const dashCache = localStorage.getItem(CACHE_KEY_DASHBOARD);
                if (dashCache) {
                    try {
                        const { data, ts } = JSON.parse(dashCache);
                        // Gunakan cache dashboard jika umurnya < 60 menit (cukup akurat untuk nilai aset global)
                        if (Date.now() - ts < 60 * 60 * 1000 && data.variants && data.stocks) {
                            // Reuse data dari dashboard (Biaya: 0 Read)
                            const costMap = {};
                            data.variants.forEach(v => costMap[v.id] = v.cost || 0);
                            
                            data.stocks.forEach(s => {
                                if (s.qty > 0) totalInv += (s.qty * (costMap[s.variant_id] || 0));
                            });
                            inventorySource = 'cache';
                        }
                    } catch (e) {}
                }
            }

            if (inventorySource === 'fetch') {
                // Jika tidak ada cache dashboard, terpaksa fetch (Biaya Mahal, tapi jarang terjadi jika flow user normal)
                const [snapSnap, snapVar] = await Promise.all([
                    getDocs(collection(db, "stock_snapshots")), 
                    getDocs(collection(db, "product_variants"))
                ]);
                
                const costMap = {}; 
                snapVar.forEach(d => costMap[d.id] = d.data().cost || 0);
                
                snapSnap.forEach(doc => { 
                    const d = doc.data(); 
                    if(d.qty > 0) totalInv += (d.qty * (costMap[d.variant_id] || 0)); 
                });
            }

            // C. Receivables (Piutang) - AGGREGATION (Biaya: 1 Read)
            const receivablesPromise = getAggregateFromServer(
                query(collection(db, "sales_orders"), where("payment_status", "==", "unpaid")), 
                { totalUnpaid: sum('net_amount') }
            );

            // D. Payables (Hutang) - AGGREGATION (Biaya: 1 Read)
            const payablesPromise = getAggregateFromServer(
                query(collection(db, "purchase_orders"), where("payment_status", "==", "unpaid")),
                { totalUnpaid: sum('total_amount') }
            );

            const [snapPiutang, snapHutang] = await Promise.all([receivablesPromise, payablesPromise]);

            const totalPiutang = snapPiutang.data().totalUnpaid || 0;
            const totalHutang = snapHutang.data().totalUnpaid || 0;

            const newAssets = { cash: totalCash, inventory: totalInv, receivable: totalPiutang, listCash };
            const newLiabilities = { payable: totalHutang };

            setAssets(newAssets);
            setLiabilities(newLiabilities);

            // 3. Simpan Cache
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    assets: newAssets,
                    liabilities: newLiabilities,
                    timestamp: Date.now()
                }));
            }

        } catch(e) { 
            console.error(e); 
            toast.error("Gagal menghitung neraca");
        } finally { 
            setLoading(false); 
        }
    };

    const totalAssets = assets.cash + assets.inventory + assets.receivable;
    const equity = totalAssets - liabilities.payable;

    return (
        <div className="max-w-6xl mx-auto space-y-8 fade-in pb-20">
            <div className="flex justify-between items-center">
            <div>
                <h2 className="text-xl md:text-3xl font-display font-bold text-lumina-text tracking-tight">Balance Sheet</h2>
                <p className="text-sm text-lumina-muted mt-1 font-light">Real-time financial position snapshot.</p>
            </div>
            <button onClick={() => calculate(true)} className="btn-ghost-dark text-xs">
                Refresh Data
            </button>
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
                                {loading ? <span className="text-xs text-lumina-muted">Calculating...</span> : assets.listCash.map((c, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-lumina-text opacity-80">{c.name}</span>
                                        <span className="font-mono font-medium text-lumina-text">{formatRupiah(c.val)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-lumina-border font-bold text-lumina-text">
                                <span>Total Cash</span>
                                <span className="text-emerald-400">{loading ? '...' : formatRupiah(assets.cash)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-lumina-muted uppercase mb-2 tracking-wide">Inventory</p>
                            <div className="flex justify-between items-center pl-3 border-l-2 border-blue-500/30">
                                <span className="text-sm text-lumina-text opacity-80">Stock Value (At Cost)</span>
                                <span className="font-bold text-blue-400 font-mono">{loading ? '...' : formatRupiah(assets.inventory)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-lumina-muted uppercase mb-2 tracking-wide">Receivables</p>
                            <div className="flex justify-between items-center pl-3 border-l-2 border-amber-500/30">
                                <span className="text-sm text-lumina-text opacity-80">Unpaid Sales</span>
                                <span className="font-bold text-amber-400 font-mono">{loading ? '...' : formatRupiah(assets.receivable)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-lumina-surface border-t border-lumina-border flex justify-between items-center">
                        <span className="font-bold text-lumina-text">TOTAL ASSETS</span>
                        <span className="font-extrabold text-emerald-500 text-xl font-mono">{loading ? '...' : formatRupiah(totalAssets)}</span>
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
                                <span className="font-bold text-rose-400 font-mono">{loading ? '...' : formatRupiah(liabilities.payable)}</span>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-lumina-surface border-t border-lumina-border flex justify-between items-center">
                            <span className="font-bold text-lumina-text">TOTAL LIABILITIES</span>
                            <span className="font-bold text-rose-500 text-lg font-mono">{loading ? '...' : formatRupiah(liabilities.payable)}</span>
                        </div>
                    </div>

                    {/* EQUITY */}
                    <div className="card-luxury p-6 bg-gradient-to-br from-lumina-surface to-lumina-highlight text-center relative overflow-hidden border-none shadow-2xl">
                        <div className="relative z-10">
                            <p className="text-xs text-lumina-muted uppercase tracking-widest mb-2 font-bold">Owners Equity</p>
                            <h3 className={`text-3xl font-display font-extrabold tracking-tight ${equity >= 0 ? 'text-lumina-text' : 'text-rose-400'}`}>
                                {loading ? '...' : formatRupiah(equity)}
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