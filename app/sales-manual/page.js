"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { formatRupiah, sortBySize } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast'; 

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_POS_MASTER = 'lumina_pos_master_v2'; // Cache utama POS
const CACHE_POS_SNAPSHOTS = 'lumina_pos_snapshots_v2'; // Cache stok
const CACHE_DURATION_MASTER = 30 * 60 * 1000; // 30 Menit (Master Data)
const CACHE_DURATION_SNAPSHOTS = 5 * 60 * 1000; // 5 Menit (Stock Data)

// Keys from other pages to reuse
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

    // Helper: Invalidate Cache LocalStorage
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(CACHE_POS_SNAPSHOTS); // Stok berubah
        localStorage.removeItem('lumina_inventory_v2'); // Inventory perlu refresh
        localStorage.removeItem('lumina_dash_master_v2'); // Dashboard cash/stock perlu refresh
        localStorage.removeItem('lumina_sales_history_v2'); // History transaksi baru
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                if (typeof window === 'undefined') return;

                // 1. Load / Reuse Master Data
                let masterData = null;
                
                // Cek Cache POS Sendiri
                const cachedPos = localStorage.getItem(CACHE_POS_MASTER);
                if (cachedPos) {
                    const { data, ts } = JSON.parse(cachedPos);
                    if (Date.now() - ts < CACHE_DURATION_MASTER) masterData = data;
                }

                // Jika tidak ada cache POS, coba reuse cache dari halaman Products/Variants (Zero Cost Strategy)
                if (!masterData) {
                    const rawProd = localStorage.getItem(CACHE_KEY_PRODUCTS);
                    const rawVar = localStorage.getItem(CACHE_KEY_VARIANTS);
                    
                    if (rawProd && rawVar) {
                        try {
                            const pCache = JSON.parse(rawProd);
                            const vCache = JSON.parse(rawVar);
                            // Validasi umur cache lain (jika < 60 menit kita anggap valid utk POS awal)
                            if (Date.now() - pCache.timestamp < 60 * 60 * 1000) {
                                // Reconstruct structure: Product -> Variants
                                const pList = pCache.products || [];
                                const vList = vCache.data || [];
                                
                                const mergedProds = pList.map(p => ({
                                    ...p,
                                    variants: vList.filter(v => v.product_id === p.id)
                                }));

                                // Kita masih butuh warehouse, customer, accounts. Fetch parsial.
                                const [whS, custS, accS] = await Promise.all([
                                    getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                                    getDocs(query(collection(db, "customers"), orderBy("name"))),
                                    getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")))
                                ]);

                                const wh = []; whS.forEach(d => wh.push({id:d.id, ...d.data()}));
                                const cust = []; custS.forEach(d => cust.push({id:d.id, ...d.data()}));
                                const acc = []; 
                                accS.forEach(d => { 
                                    const c = d.data().category.toLowerCase(); 
                                    if(c.includes('kas') || c.includes('bank')) acc.push({id:d.id, ...d.data()}); 
                                });

                                masterData = { wh, cust, acc, prods: mergedProds };
                                // Simpan ke cache POS
                                localStorage.setItem(CACHE_POS_MASTER, JSON.stringify({ data: masterData, ts: Date.now() }));
                            }
                        } catch (e) { console.warn("Failed to reuse cache", e); }
                    }
                }

                // Fallback: Full Fetch jika tidak ada cache sama sekali
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
                    const acc = []; 
                    accS.forEach(d => { 
                        const c = d.data().category.toLowerCase(); 
                        if(c.includes('kas') || c.includes('bank')) acc.push({id:d.id, ...d.data()}); 
                    });
                    const vars = []; varS.forEach(d => vars.push({id:d.id, ...d.data()}));
                    const prods = []; 
                    prodS.forEach(d => { 
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
                    // Default ke warehouse non-virtual jika ada
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
                    if (Date.now() - ts < CACHE_DURATION_SNAPSHOTS) {
                        stockData = data;
                    }
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
        toast.success("Item masuk keranjang", { duration: 1000, icon: '🛒' });
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
        
        if(!confirm("Proses Transaksi?")) return;
        
        const checkoutPromise = new Promise(async (resolve, reject) => {
            try {
                const orderId = `ORD-${Date.now()}`;
                const custName = selectedCustId ? customers.find(c => c.id === selectedCustId).name : 'Guest';
                
                await runTransaction(db, async (t) => {
                    const soRef = doc(collection(db, "sales_orders"));
                    t.set(soRef, { 
                        order_number: orderId, warehouse_id: selectedWh, source: 'pos', 
                        customer_id: selectedCustId || null, customer_name: custName, 
                        order_date: serverTimestamp(), status: 'completed', payment_status: 'paid', 
                        gross_amount: total, net_amount: total, payment_account_id: paymentAccId, 
                        items_summary: cart.map(c => `${c.sku}(${c.qty})`).join(', '), 
                        created_by: auth.currentUser?.email 
                    });
                    
                    for(const i of cart) {
                        t.set(doc(collection(db, `sales_orders/${soRef.id}/items`)), { 
                            variant_id: i.id, sku: i.sku, qty: i.qty, unit_price: i.price, unit_cost: i.cost 
                        });
                        t.set(doc(collection(db, "stock_movements")), { 
                            variant_id: i.id, warehouse_id: selectedWh, type: 'sale_out', 
                            qty: -i.qty, ref_id: soRef.id, ref_type: 'sales_order', date: serverTimestamp() 
                        });
                        const sRef = doc(db, "stock_snapshots", `${i.id}_${selectedWh}`); 
                        const sDoc = await t.get(sRef); 
                        if(sDoc.exists()) {
                            const newQty = sDoc.data().qty - i.qty;
                            if (newQty < 0) throw new Error(`Stok ${i.sku} tidak cukup!`);
                            t.update(sRef, { qty: newQty });
                        } else {
                            throw new Error(`Data stok ${i.sku} tidak ditemukan!`);
                        }
                    }
                    
                    t.set(doc(collection(db, "cash_transactions")), { 
                        type: 'in', amount: total, date: serverTimestamp(), 
                        category: 'penjualan', account_id: paymentAccId, 
                        description: `POS ${orderId}`, ref_type: 'sales_order', ref_id: soRef.id 
                    });
                    
                    const accRef = doc(db, "cash_accounts", paymentAccId); 
                    const accDoc = await t.get(accRef); 
                    if(accDoc.exists()) t.update(accRef, { balance: (accDoc.data().balance || 0) + total });
                });

                invalidateRelatedCaches();
                
                // Update Local Snapshots Optimistically
                const newSnaps = { ...snapshots };
                cart.forEach(i => {
                    const key = `${i.id}_${selectedWh}`;
                    if (newSnaps[key]) newSnaps[key] -= i.qty;
                });
                setSnapshots(newSnaps);
                localStorage.setItem(CACHE_POS_SNAPSHOTS, JSON.stringify({ data: newSnaps, ts: Date.now() })); // Update cache lokal

                setInvoiceData({ id: orderId, total, received, change: received - total, items: cart, date: new Date(), customer: custName }); 
                setModalInvoiceOpen(true); 
                setCart([]); 
                setCashReceived('');
                resolve();
            } catch(e) { reject(e); }
        });

        toast.promise(checkoutPromise, {
            loading: 'Memproses transaksi...',
            success: 'Transaksi Berhasil!',
            error: (err) => `Gagal: ${err.message}`,
        });
    };

    const handlePrint = () => { window.print(); };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.base_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 30);

    const cartTotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const change = (parseInt(cashReceived) || 0) - cartTotal;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)] fade-in relative">
            
            {/* --- MOBILE TAB SWITCHER --- */}
            <div className="lg:hidden flex bg-lumina-surface p-1 rounded-xl border border-lumina-border mb-2 sticky top-0 z-20">
                <button 
                    onClick={() => setActiveMobileTab('products')}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeMobileTab === 'products' ? 'bg-lumina-gold text-black shadow-gold-glow' : 'text-lumina-muted'}`}
                >
                    Katalog Produk
                </button>
                <button 
                    onClick={() => setActiveMobileTab('cart')}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all relative ${activeMobileTab === 'cart' ? 'bg-lumina-gold text-black shadow-gold-glow' : 'text-lumina-muted'}`}
                >
                    Keranjang
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center border border-lumina-base">
                            {cart.length}
                        </span>
                    )}
                </button>
            </div>

            {/* HIDDEN RECEIPT */}
            <div id="receipt-print-area" className="hidden bg-white text-black font-mono text-xs p-2 max-w-[300px]">
                <div className="text-center mb-4"><h2 className="text-sm font-bold uppercase">BOBING STORE</h2><p>Jl. Contoh No. 123, Kota</p></div>
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

            {/* LEFT: PRODUCTS (Conditional render on mobile) */}
            <div className={`w-full lg:w-2/3 flex flex-col gap-4 h-full ${activeMobileTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
                <div className="card-luxury p-4 flex gap-3 items-center shrink-0">
                    <div className="relative flex-1">
                        <input ref={searchInputRef} type="text" className="input-luxury pl-10" placeholder="Cari Produk (F2)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleSearchEnter} />
                        <svg className="w-5 h-5 text-lumina-muted absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <select className="input-luxury w-32 md:w-48" value={selectedWh} onChange={e=>setSelectedWh(e.target.value)}>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 content-start">
                    {loading ? <div className="col-span-full text-center py-10 text-lumina-muted">Loading...</div> : filteredProducts.map(p => {
                        const stock = p.variants.reduce((a,b) => a + (snapshots[`${b.id}_${selectedWh}`] || 0), 0);
                        return (
                            <div key={p.id} onClick={() => { setSelectedProdForVariant(p); setModalVariantOpen(true); }} className={`card-luxury p-3 md:p-4 cursor-pointer hover:border-lumina-gold/50 transition-all flex flex-col justify-between group active:scale-95 ${stock<=0?'opacity-50':''}`}>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-[9px] font-mono font-bold text-lumina-muted bg-lumina-base px-1.5 py-0.5 rounded border border-lumina-border">{p.base_sku}</span>
                                        <span className={`text-[9px] px-2 rounded ${stock>0?'text-emerald-400 bg-emerald-900/30':'text-rose-400 bg-rose-900/30'}`}>{stock}</span>
                                    </div>
                                    <h4 className="text-xs md:text-sm font-bold text-lumina-text group-hover:text-lumina-gold line-clamp-2 leading-tight">{p.name}</h4>
                                </div>
                                <div className="mt-2 pt-2 border-t border-lumina-border text-[10px] text-lumina-muted text-right flex justify-between items-center">
                                    <span className="badge-luxury badge-neutral text-[9px] border-0 bg-lumina-highlight/50">{p.brand_name}</span>
                                    <span>{p.variants.length} Varian</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* RIGHT: CART (Conditional render on mobile) */}
            <div className={`w-full lg:w-1/3 card-luxury flex flex-col h-full overflow-hidden border-lumina-border ${activeMobileTab === 'cart' ? 'flex h-[80vh]' : 'hidden lg:flex'}`}>
                <div className="p-4 border-b border-lumina-border bg-lumina-surface flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lumina-text">Keranjang ({cart.length})</h3>
                    <button onClick={()=>setCart([])} className="text-xs text-rose-400 hover:text-white border border-rose-500/30 px-2 py-1 rounded">HAPUS (F8)</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-lumina-base">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-lumina-muted opacity-50">
                            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                            <p className="text-xs">Keranjang Kosong</p>
                        </div>
                    ) : cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-lumina-border pb-3 last:border-0 animate-fade-in">
                            <div className="flex-1 mr-3">
                                <div className="text-sm font-medium text-lumina-text line-clamp-1">{item.name}</div>
                                <div className="text-xs text-lumina-muted mt-0.5 flex items-center gap-2">
                                    <span className="text-lumina-gold font-mono">{item.sku}</span>
                                    <span className="badge-luxury badge-neutral py-0 px-1.5 text-[9px]">{item.spec}</span>
                                </div>
                                <div className="text-xs font-bold text-emerald-400 mt-1">{formatRupiah(item.price)}</div>
                            </div>
                            <div className="flex items-center bg-lumina-surface rounded-lg border border-lumina-border shadow-sm">
                                <button onClick={() => { const n = [...cart]; if(n[idx].qty > 1) n[idx].qty--; else n.splice(idx, 1); setCart(n); }} className="w-8 h-8 flex items-center justify-center text-lumina-muted hover:text-white active:bg-lumina-highlight transition-colors">-</button>
                                <span className="text-sm font-bold w-8 text-center text-lumina-text">{item.qty}</span>
                                <button onClick={() => { if(item.qty < item.max) { const n = [...cart]; n[idx].qty++; setCart(n); } else { toast.error('Stok max'); } }} className="w-8 h-8 flex items-center justify-center text-lumina-muted hover:text-white active:bg-lumina-highlight transition-colors">+</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-5 border-t border-lumina-border bg-lumina-surface space-y-3 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] relative z-10">
                    <div className="grid grid-cols-2 gap-2">
                        <select className="input-luxury py-2 text-xs" value={selectedCustId} onChange={e=>setSelectedCustId(e.target.value)}>
                            <option value="">Tamu (Guest)</option>
                            {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="input-luxury py-2 text-xs" value={paymentAccId} onChange={e=>setPaymentAccId(e.target.value)}>
                            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-between pt-2 items-end">
                        <span className="text-xs text-lumina-muted uppercase tracking-wider font-bold">Total Tagihan</span>
                        <span className="text-2xl font-display font-bold text-lumina-gold">{formatRupiah(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-lumina-base p-2.5 rounded-xl border border-lumina-border focus-within:border-lumina-gold transition-colors">
                        <span className="text-xs text-lumina-muted font-bold uppercase ml-1">Bayar</span>
                        <input type="number" className="text-right font-bold text-white bg-transparent outline-none w-32 text-lg placeholder:text-lumina-muted/30" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder="0" />
                    </div>
                    <div className="flex justify-between px-1">
                        <span className="text-xs text-lumina-muted">Kembalian</span>
                        <span className={`text-sm font-bold font-mono ${change<0?'text-rose-500':'text-emerald-500'}`}>{formatRupiah(Math.max(0,change))}</span>
                    </div>
                    <button onClick={handleCheckout} className="btn-gold w-full py-3 text-sm shadow-lg shadow-yellow-500/10">
                        BAYAR & CETAK (F9)
                    </button>
                </div>
            </div>

            {/* MODAL VARIANT */}
            <Portal>
            {modalVariantOpen && selectedProdForVariant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="card-luxury w-full max-w-lg p-0 overflow-hidden fade-in-up max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-lumina-border bg-lumina-surface flex justify-between items-center sticky top-0 z-10">
                            <div>
                                <h3 className="font-bold text-lumina-text text-lg">{selectedProdForVariant.name}</h3>
                                <p className="text-xs text-lumina-muted font-mono">{selectedProdForVariant.base_sku}</p>
                            </div>
                            <button onClick={()=>setModalVariantOpen(false)} className="text-lumina-muted hover:text-white p-2">✕</button>
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
                                                <td className="text-right text-xs text-lumina-muted font-mono">{formatRupiah(v.price)}</td>
                                                <td className="text-center text-xs">
                                                    <span className={`px-2 py-1 rounded ${qty>0?'bg-emerald-900/30 text-emerald-400':'bg-rose-900/30 text-rose-400'}`}>{qty}</span>
                                                </td>
                                                <td className="pr-4 text-right">
                                                    <button disabled={qty<=0} onClick={()=>addToCart(v, selectedProdForVariant.name)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 ${qty>0?'bg-lumina-gold text-black shadow-gold-glow':'bg-lumina-highlight text-lumina-muted cursor-not-allowed'}`}>
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
            </Portal>

            {/* MODAL SUCCESS */}
            <Portal>
            {modalInvoiceOpen && invoiceData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="card-luxury max-w-sm w-full p-8 text-center relative overflow-hidden fade-in-up border-lumina-gold/50">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h2 className="text-xl md:text-3xl font-extrabold text-white">
                            Transaksi Berhasil!
                        </h2>

                        <div className="bg-lumina-base p-5 rounded-2xl border border-lumina-border space-y-3 mt-6">
                            <div className="flex justify-between text-sm"><span className="text-lumina-muted">Total</span><span className="font-bold text-white">{formatRupiah(invoiceData.total)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-lumina-muted">Tunai</span><span className="font-bold text-white">{formatRupiah(invoiceData.received)}</span></div>
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