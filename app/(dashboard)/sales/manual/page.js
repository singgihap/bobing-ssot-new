"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { formatRupiah, sortBySize } from '@/lib/utils'; // Added sortBySize here
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast'; 
import PageHeader from '@/components/PageHeader';

// KONFIGURASI CACHE
const CACHE_POS_MASTER = 'lumina_pos_master_v2';
const CACHE_POS_SNAPSHOTS = 'lumina_pos_snapshots_v2';
const CACHE_DURATION_MASTER = 30 * 60 * 1000;
const CACHE_DURATION_SNAPSHOTS = 5 * 60 * 1000;
const CACHE_KEY_PRODUCTS = 'lumina_products_data_v2';
const CACHE_KEY_VARIANTS = 'lumina_variants_v2';

export default function PosPage() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    const [selectedWh, setSelectedWh] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [cashReceived, setCashReceived] = useState('');
    
    // Mobile State
    const [activeMobileTab, setActiveMobileTab] = useState('products'); 

    const [modalVariantOpen, setModalVariantOpen] = useState(false);
    const [selectedProdForVariant, setSelectedProdForVariant] = useState(null);
    const [modalInvoiceOpen, setModalInvoiceOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    const [paymentAccId, setPaymentAccId] = useState('');
    const [selectedCustId, setSelectedCustId] = useState('');

    const searchInputRef = useRef(null);

    // Invalidate Caches after Transaction
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(CACHE_POS_SNAPSHOTS);
        localStorage.removeItem('lumina_inventory_v2');
        localStorage.removeItem('lumina_dash_master_v3'); // Trigger update Inventory Value
        localStorage.removeItem('lumina_sales_history_v2');
        localStorage.removeItem('lumina_balance_v2');
        localStorage.removeItem('lumina_cash_data_v2');
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                if (typeof window === 'undefined') return;

                // 1. Load / Reuse Master Data
                let masterData = null;
                const cachedPos = localStorage.getItem(CACHE_POS_MASTER);
                if (cachedPos) {
                    const { data, ts } = JSON.parse(cachedPos);
                    if (Date.now() - ts < CACHE_DURATION_MASTER) masterData = data;
                }

                if (!masterData) {
                    // Coba Nebeng Cache (Zero Cost)
                    const rawProd = localStorage.getItem(CACHE_KEY_PRODUCTS);
                    const rawVar = localStorage.getItem(CACHE_KEY_VARIANTS);
                    
                    if (rawProd && rawVar) {
                        try {
                            const pCache = JSON.parse(rawProd);
                            const vCache = JSON.parse(rawVar);
                            // Reconstruct
                            const pList = pCache.products || [];
                            const vList = vCache.data || [];
                            const mergedProds = pList.map(p => ({ ...p, variants: vList.filter(v => v.product_id === p.id) }));

                            // Fetch partial data yang kurang
                            const [whS, custS, accS] = await Promise.all([
                                getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                                getDocs(query(collection(db, "customers"), orderBy("name"))),
                                getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")))
                            ]);

                            const wh = []; whS.forEach(d => wh.push({id:d.id, ...d.data()}));
                            const cust = []; custS.forEach(d => cust.push({id:d.id, ...d.data()}));
                            const acc = []; accS.forEach(d => { 
                                const c = d.data().category.toLowerCase(); 
                                if(c.includes('kas') || c.includes('bank') || c.includes('aset')) acc.push({id:d.id, ...d.data()}); 
                            });

                            masterData = { wh, cust, acc, prods: mergedProds };
                            localStorage.setItem(CACHE_POS_MASTER, JSON.stringify({ data: masterData, ts: Date.now() }));
                        } catch (e) {}
                    }
                }

                // Fallback Full Fetch
                if (!masterData) {
                    const [whS, prodS, varS, custS, accS] = await Promise.all([
                        getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                        getDocs(collection(db, "products")), 
                        getDocs(query(collection(db, "product_variants"), orderBy("sku"))),
                        getDocs(query(collection(db, "customers"), orderBy("name"))),
                        getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")))
                    ]);

                    const wh = []; whS.forEach(d => wh.push({id:d.id, ...d.data()}));
                    const cust = []; custS.forEach(d => cust.push({id:d.id, ...d.data()}));
                    const acc = []; accS.forEach(d => { 
                        const c = d.data().category.toLowerCase(); 
                        if(c.includes('kas') || c.includes('bank') || c.includes('aset')) acc.push({id:d.id, ...d.data()}); 
                    });
                    const vars = []; varS.forEach(d => vars.push({id:d.id, ...d.data()}));
                    const prods = []; prodS.forEach(d => { 
                        const p = d.data(); 
                        const pVars = vars.filter(v => v.product_id === d.id); 
                        prods.push({ id: d.id, ...p, variants: pVars }); 
                    });

                    masterData = { wh, cust, acc, prods };
                    localStorage.setItem(CACHE_POS_MASTER, JSON.stringify({ data: masterData, ts: Date.now() }));
                }

                setWarehouses(masterData.wh);
                setCustomers(masterData.cust);
                setAccounts(masterData.acc);
                setProducts(masterData.prods);

                if(masterData.wh.length > 0) {
                    const defWh = masterData.wh.find(w=>w.type!=='virtual_supplier')?.id || masterData.wh[0].id;
                    setSelectedWh(defWh);
                }
                
                const defAcc = masterData.acc.find(a => a.code === '1101' || a.code === '1201'); 
                if(defAcc) setPaymentAccId(defAcc.id);

                // 2. Load Snapshots (Stok) - Cached separately
                let stockData = {};
                const cachedSnaps = localStorage.getItem(CACHE_POS_SNAPSHOTS);
                if (cachedSnaps) {
                    const { data, ts } = JSON.parse(cachedSnaps);
                    if (Date.now() - ts < CACHE_DURATION_SNAPSHOTS) stockData = data;
                }

                if (Object.keys(stockData).length === 0) {
                    const snapS = await getDocs(collection(db, "stock_snapshots"));
                    snapS.forEach(d => stockData[d.id] = d.data().qty || 0); 
                    localStorage.setItem(CACHE_POS_SNAPSHOTS, JSON.stringify({ data: stockData, ts: Date.now() }));
                }
                setSnapshots(stockData);

            } catch(e) { console.error(e); toast.error("Gagal memuat data POS"); } finally { setLoading(false); }
        };
        init();
    }, []);

    useEffect(() => {
        const handleKey = (e) => { 
            if(e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); } 
            if(e.key === 'F9') handleCheckout(); 
            if(e.key === 'F8') setCart([]); 
        };
        window.addEventListener('keydown', handleKey); 
        return () => window.removeEventListener('keydown', handleKey);
    }, [cart, paymentAccId, cashReceived]); 

    const addToCart = (variant, prodName) => {
        const key = `${variant.id}_${selectedWh}`; 
        const max = snapshots[key] || 0;
        
        if(max <= 0) return toast.error("Stok Habis!");
        
        const existIdx = cart.findIndex(i => i.id === variant.id);
        if(existIdx > -1) { 
            const newCart = [...cart]; 
            if(newCart[existIdx].qty + 1 > max) return toast.error("Stok Maksimal"); 
            newCart[existIdx].qty += 1; 
            setCart(newCart); 
        } else { 
            setCart([...cart, { 
                id: variant.id, sku: variant.sku, name: prodName, spec: `${variant.color}/${variant.size}`, 
                price: variant.price, cost: variant.cost, qty: 1, max 
            }]); 
        }
        setModalVariantOpen(false); 
        setSearchTerm('');
        toast.success("Item +1", { duration: 800, icon: '🛒' });
    };

    const handleSearchEnter = (e) => {
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            const k = searchTerm.trim().toUpperCase(); 
            if(!k) return; 
            
            let fV=null, fP=null; 
            for(const p of products) { 
                const v = p.variants.find(x => x.sku===k || x.barcode===k); 
                if(v) { fV=v; fP=p; break; } 
            } 
            if(fV) addToCart(fV, fP.name); 
            else toast.error("Barang tidak ditemukan");
        }
    };

    const handleCheckout = async () => {
        if(cart.length === 0) return toast.error("Keranjang kosong");
        const total = cart.reduce((a,b) => a + (b.price * b.qty), 0); 
        const received = parseInt(cashReceived) || 0;
        if(received < total) return toast.error("Uang kurang!");
        
        if(!confirm("Proses Transaksi?")) return;
        
        const toastId = toast.loading("Memproses...");
        
        try {
            const orderId = `ORD-${Date.now()}`;
            const custName = selectedCustId ? customers.find(c => c.id === selectedCustId).name : 'Guest';
            const batch = writeBatch(db);

            // 1. Sales Order Header
            const soRef = doc(collection(db, "sales_orders"));
            batch.set(soRef, { 
                order_number: orderId, warehouse_id: selectedWh, source: 'pos', 
                customer_id: selectedCustId || null, customer_name: custName, 
                order_date: serverTimestamp(), status: 'completed', payment_status: 'paid', 
                gross_amount: total, net_amount: total, payment_account_id: paymentAccId, 
                items_summary: cart.map(c => `${c.sku}(${c.qty})`).join(', '), 
                created_by: auth.currentUser?.email 
            });
            
            // 2. Items & Stock & Movements
            for(const i of cart) {
                const itemRef = doc(collection(db, `sales_orders/${soRef.id}/items`));
                batch.set(itemRef, { variant_id: i.id, sku: i.sku, qty: i.qty, unit_price: i.price, unit_cost: i.cost });
                
                const moveRef = doc(collection(db, "stock_movements"));
                batch.set(moveRef, { 
                    variant_id: i.id, warehouse_id: selectedWh, type: 'sale_out', 
                    qty: -i.qty, ref_id: soRef.id, ref_type: 'sales_order', date: serverTimestamp() 
                });
                
                // Increment Update (No Read Needed!)
                const snapRef = doc(db, "stock_snapshots", `${i.id}_${selectedWh}`);
                batch.set(snapRef, { 
                    id: `${i.id}_${selectedWh}`, variant_id: i.id, warehouse_id: selectedWh, 
                    qty: increment(-i.qty) 
                }, { merge: true });
            }
            
            // 3. Cash Transaction
            const cashRef = doc(collection(db, "cash_transactions"));
            batch.set(cashRef, { 
                type: 'in', amount: total, date: serverTimestamp(), 
                category: 'penjualan', account_id: paymentAccId, 
                description: `POS ${orderId}`, ref_type: 'sales_order', ref_id: soRef.id 
            });
            
            // 4. Update Balance (Increment)
            const accRef = doc(db, "cash_accounts", paymentAccId); 
            batch.update(accRef, { balance: increment(total) });

            await batch.commit(); // ONE ATOMIC COMMIT

            invalidateRelatedCaches();
            
            // Update Local Snapshots UI
            const newSnaps = { ...snapshots };
            cart.forEach(i => {
                const key = `${i.id}_${selectedWh}`;
                if (newSnaps[key]) newSnaps[key] -= i.qty;
            });
            setSnapshots(newSnaps);
            localStorage.setItem(CACHE_POS_SNAPSHOTS, JSON.stringify({ data: newSnaps, ts: Date.now() })); 

            setInvoiceData({ id: orderId, total, received, change: received - total, items: cart, date: new Date(), customer: custName }); 
            setModalInvoiceOpen(true); 
            setCart([]); 
            setCashReceived('');
            toast.success("Transaksi Berhasil!", { id: toastId });
            
        } catch(e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    const handlePrint = () => { window.print(); };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.base_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 30);

    const cartTotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const change = (parseInt(cashReceived) || 0) - cartTotal;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)] fade-in relative pb-20 lg:pb-0">
            
            {/* --- MOBILE TAB SWITCHER (Sama) --- */}
            <div className="lg:hidden flex bg-surface p-1 rounded-xl border border-lumina-border mb-2 sticky top-0 z-20 shadow-lg">
                <button 
                    onClick={() => setActiveMobileTab('products')}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeMobileTab === 'products' ? 'bg-primary text-black shadow-accent-glow' : 'text-text-secondary'}`}
                >
                    Katalog
                </button>
                <button 
                    onClick={() => setActiveMobileTab('cart')}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all relative ${activeMobileTab === 'cart' ? 'bg-primary text-black shadow-accent-glow' : 'text-text-secondary'}`}
                >
                    Keranjang ({cart.length})
                </button>
            </div>

            {/* HIDDEN RECEIPT */}
            <div id="receipt-print-area" className="hidden bg-white text-black font-mono text-xs p-2 max-w-[300px]">
                <div className="text-center mb-4"><h2 className="text-sm font-bold uppercase">BOBING STORE</h2><p>Terima Kasih</p></div>
                <div className="border-b border-black border-dashed mb-2"></div>
                <div className="flex justify-between mb-2"><span>{invoiceData?.id}</span><span>{invoiceData?.date?.toLocaleDateString()}</span></div>
                <div className="mb-2">Cust: {invoiceData?.customer}</div>
                <div className="border-b border-black border-dashed mb-2"></div>
                {invoiceData?.items.map((item, i) => (
                    <div key={i} className="mb-2"><div>{item.name} ({item.spec})</div><div className="flex justify-between"><span>{item.qty} x {parseInt(item.price).toLocaleString()}</span><span>{(item.qty * item.price).toLocaleString()}</span></div></div>
                ))}
                <div className="border-b border-black border-dashed my-2"></div>
                <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>Rp {invoiceData?.total?.toLocaleString()}</span></div>
                <div className="flex justify-between mt-1"><span>Tunai</span><span>Rp {invoiceData?.received?.toLocaleString()}</span></div>
                <div className="flex justify-between mt-1"><span>Kembali</span><span>Rp {invoiceData?.change?.toLocaleString()}</span></div>
            </div>

            {/* LEFT: PRODUCTS (Full Width on Mobile if Active) */}
            <div className={`w-full lg:w-2/3 flex flex-col gap-4 h-full ${activeMobileTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
                
                {/* --- SEARCH BAR MEWAH (Konsisten UI) --- */}
                <PageHeader title="Point of Sales" subtitle="Kasir & Transaksi Cepat">
                    <div className="bg-[#FFFFFF] p-2 rounded-xl border border-lumina-border/50 flex flex-col md:flex-row gap-2 items-center w-full md:w-auto">
                        <div className="relative flex-1 w-full">
                            <input 
                                ref={searchInputRef} 
                                type="text" 
                                className="input-luxury pl-10 py-2 text-sm bg-[#dddddd]" 
                                placeholder="Cari (F2)..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                onKeyDown={handleSearchEnter} 
                            />
                            <svg className="w-4 h-4 text-lumina-gold absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        <select className="input-luxury w-full md:w-32 bg-[#dddddd] py-2 text-xs" value={selectedWh} onChange={e=>setSelectedWh(e.target.value)}>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </PageHeader>

                {/* PRODUCT GRID */}
                <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 content-start pb-24 lg:pb-0">
                    {loading ? <div className="col-span-full text-center py-10 text-text-secondary">Loading...</div> : filteredProducts.map(p => {
                        const stock = p.variants.reduce((a,b) => a + (snapshots[`${b.id}_${selectedWh}`] || 0), 0);
                        return (
                            <div key={p.id} onClick={() => { setSelectedProdForVariant(p); setModalVariantOpen(true); }} className={`card-luxury p-3 md:p-4 cursor-pointer hover:border-lumina-gold/50 transition-all flex flex-col justify-between group active:scale-95 bg-[#FFFFFF] border-lumina-border/30 ${stock<=0?'opacity-50':''}`}>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-[9px] font-mono font-bold text-text-secondary bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{p.base_sku}</span>
                                        <span className={`text-[9px] px-2 rounded font-bold ${stock>0?'text-emerald-400 bg-emerald-500/10':'text-rose-400 bg-rose-500/10'}`}>{stock}</span>
                                    </div>
                                    <h4 className="text-xs md:text-sm font-bold text-text-primary group-hover:text-lumina-gold line-clamp-2 leading-tight min-h-[2.5em]">{p.name}</h4>
                                </div>
                                <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-text-secondary text-right flex justify-between items-center">
                                    <span className="badge-luxury badge-neutral text-[9px] border-0 bg-white/5">{p.brand_name}</span>
                                    <span>{p.variants.length} Varian</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* RIGHT: CART (Fixed on Desktop, Tab on Mobile) */}
            <div className={`w-full lg:w-1/3 card-luxury flex flex-col h-full overflow-hidden border-lumina-border/50 bg-[#FFFFFF] ${activeMobileTab === 'cart' ? 'flex fixed inset-0 z-30 lg:static' : 'hidden lg:flex'}`}>
                
                <div className="p-5 border-b border-lumina-border/50 bg-[#FFFFFF] flex justify-between items-center shrink-0 shadow-md z-10">
                    <h3 className="font-bold text-text-primary text-lg flex items-center gap-2">
                        <svg className="w-5 h-5 text-lumina-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                        Keranjang
                        <span className="bg-primary text-black text-xs px-2 py-0.5 rounded-full ml-2">{cart.length}</span>
                    </h3>
                    <button onClick={()=>setCart([])} className="text-xs text-rose-400 hover:text-text-primary border border-rose-500/30 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-all">RESET (F8)</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#dddddd]/50 scrollbar-hide">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-30">
                            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                            <p className="text-sm font-medium">Belum ada item</p>
                        </div>
                    ) : cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#181A25] p-3 rounded-xl border border-white/5 hover:border-lumina-gold/30 transition-all shadow-sm animate-fade-in">
                            <div className="flex-1 mr-3">
                                <div className="text-sm font-bold text-text-primary line-clamp-1">{item.name}</div>
                                <div className="text-xs text-text-secondary mt-1 flex items-center gap-2">
                                    <span className="text-lumina-gold font-mono bg-primary/10 px-1 rounded">{item.sku}</span>
                                    <span className="text-[10px] bg-white/10 px-1.5 rounded text-text-primary/70">{item.spec}</span>
                                </div>
                                <div className="text-sm font-bold text-emerald-400 mt-1">{formatRupiah(item.price)}</div>
                            </div>
                            <div className="flex items-center bg-[#dddddd] rounded-lg border border-white/10 shadow-inner">
                                <button onClick={() => { const n = [...cart]; if(n[idx].qty > 1) n[idx].qty--; else n.splice(idx, 1); setCart(n); }} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-l-lg transition-colors">-</button>
                                <span className="text-sm font-bold w-8 text-center text-text-primary">{item.qty}</span>
                                <button onClick={() => { if(item.qty < item.max) { const n = [...cart]; n[idx].qty++; setCart(n); } else { toast.error('Stok max'); } }} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-r-lg transition-colors">+</button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* BILLING AREA */}
                <div className="p-5 border-t border-lumina-border bg-[#FFFFFF] space-y-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
                    <div className="grid grid-cols-2 gap-3">
                        <select className="input-luxury py-2 text-xs bg-[#dddddd]" value={selectedCustId} onChange={e=>setSelectedCustId(e.target.value)}>
                            <option value="">👤 Tamu (Guest)</option>
                            {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="input-luxury py-2 text-xs bg-[#dddddd]" value={paymentAccId} onChange={e=>setPaymentAccId(e.target.value)}>
                            {accounts.map(a=><option key={a.id} value={a.id}>💳 {a.name}</option>)}
                        </select>
                    </div>
                    
                    <div className="space-y-1 py-2">
                        <div className="flex justify-between items-end">
                            <span className="text-xs text-text-secondary uppercase tracking-wider font-bold">Total Tagihan</span>
                            <span className="text-3xl font-display font-bold text-text-primary">{formatRupiah(cartTotal)}</span>
                        </div>
                    </div>

                    <div className="bg-[#dddddd] p-3 rounded-xl border border-lumina-border/50 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-text-secondary font-bold uppercase ml-1">Uang Diterima</span>
                            <input type="number" className="text-right font-bold text-lumina-gold bg-transparent outline-none w-32 text-xl placeholder:text-text-secondary/20" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder="0" />
                        </div>
                        <div className="h-px bg-white/10 w-full"></div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-text-secondary ml-1">Kembalian</span>
                            <span className={`text-sm font-bold font-mono ${change<0?'text-rose-500':'text-emerald-400'}`}>{formatRupiah(Math.max(0,change))}</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleCheckout} 
                        className="btn-gold w-full py-4 text-sm shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:shadow-[0_0_30px_rgba(212,175,55,0.6)] transform hover:-translate-y-1 transition-all font-bold tracking-wide text-black"
                    >
                        BAYAR SEKARANG (F9)
                    </button>
                </div>
            </div>

            {/* MODAL VARIANT & SUCCESS */}
            <Portal>
                {/* Variant Modal */}
                {modalVariantOpen && selectedProdForVariant && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4">
                        <div className="card-luxury w-full max-w-lg p-0 overflow-hidden fade-in-up max-h-[80vh] flex flex-col">
                            <div className="p-4 border-b border-lumina-border bg-surface flex justify-between items-center sticky top-0 z-10">
                                <div>
                                    <h3 className="font-bold text-text-primary text-lg">{selectedProdForVariant.name}</h3>
                                    <p className="text-xs text-text-secondary font-mono">{selectedProdForVariant.base_sku}</p>
                                </div>
                                <button onClick={()=>setModalVariantOpen(false)} className="text-text-secondary hover:text-text-primary p-2">✕</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                                <table className="table-dark">
                                    <tbody>
                                        {selectedProdForVariant.variants.sort(sortBySize).map(v => { 
                                            const qty = snapshots[`${v.id}_${selectedWh}`] || 0; 
                                            return (
                                                <tr key={v.id} className="border-b border-lumina-border/50 last:border-0">
                                                    <td className="pl-4 py-3 font-medium text-sm">
                                                        {v.color} / {v.size}
                                                    </td>
                                                    <td className="text-right text-xs text-text-secondary font-mono">{formatRupiah(v.price)}</td>
                                                    <td className="text-center text-xs">
                                                        <span className={`px-2 py-1 rounded ${qty>0?'bg-emerald-900/30 text-emerald-400':'bg-rose-900/30 text-rose-400'}`}>{qty}</span>
                                                    </td>
                                                    <td className="pr-4 text-right">
                                                        <button disabled={qty<=0} onClick={()=>addToCart(v, selectedProdForVariant.name)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${qty>0?'bg-primary text-black shadow-accent-glow':'bg-lumina-highlight text-text-secondary cursor-not-allowed'}`}>
                                                            + Add
                                                        </button>
                                                    </td>
                                                </tr> 
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Success Modal */}
                {modalInvoiceOpen && invoiceData && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface/90 backdrop-blur-md p-4">
                        <div className="card-luxury max-w-sm w-full p-8 text-center relative overflow-hidden fade-in-up border-lumina-gold/50">
                            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h2 className="text-xl md:text-3xl font-extrabold text-text-primary">
                                Transaksi Berhasil!
                            </h2>

                            <div className="bg-surface p-5 rounded-2xl border border-lumina-border space-y-3 mt-6">
                                <div className="flex justify-between text-sm"><span className="text-text-secondary">Total</span><span className="font-bold text-text-primary">{formatRupiah(invoiceData.total)}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-text-secondary">Tunai</span><span className="font-bold text-text-primary">{formatRupiah(invoiceData.received)}</span></div>
                                <div className="border-t border-lumina-border my-2"></div>
                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-emerald-400">Kembali</span><span className="text-xl font-extrabold text-emerald-400">{formatRupiah(Math.max(0, invoiceData.change))}</span></div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button onClick={handlePrint} className="flex-1 btn-ghost-dark py-3 flex items-center justify-center gap-2">Cetak</button>
                                <button onClick={()=>setModalInvoiceOpen(false)} className="flex-1 btn-gold py-3">Baru</button>
                            </div>
                        </div>
                    </div>
                )}
            </Portal>
        </div>
    );
}