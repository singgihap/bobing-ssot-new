"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, query, orderBy, serverTimestamp, increment, writeBatch, addDoc } from 'firebase/firestore';
import { formatRupiah, sortBySize } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast'; 
import PageHeader from '@/components/PageHeader';

// --- MODERN UI LIBRARIES ---
import { Search, RotateCcw, ShoppingCart, User, Plus, X, Trash2, CreditCard, ChevronRight, Package, Phone, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { NumericFormat } from 'react-number-format';

// KONFIGURASI CACHE
const CACHE_POS_MASTER = 'lumina_pos_master_v2';
const CACHE_POS_SNAPSHOTS = 'lumina_pos_snapshots_v2';
const CACHE_DURATION_MASTER = 30 * 60 * 1000;
const CACHE_DURATION_SNAPSHOTS = 5 * 60 * 1000;

export default function PosPage() {
    // --- STATE MANAGEMENT ---
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    
    // UI State
    const [selectedWh, setSelectedWh] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [cashReceived, setCashReceived] = useState(''); 
    const [lastRefresh, setLastRefresh] = useState(null);
    
    // Customer Search State
    const [custSearch, setCustSearch] = useState('');
    const [showCustDropdown, setShowCustDropdown] = useState(false);
    
    // Modals State
    const [modalCustomerOpen, setModalCustomerOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
    const [modalVariantOpen, setModalVariantOpen] = useState(false);
    const [selectedProdForVariant, setSelectedProdForVariant] = useState(null);
    const [modalInvoiceOpen, setModalInvoiceOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    
    // Selection
    const [paymentAccId, setPaymentAccId] = useState('');
    const [selectedCustId, setSelectedCustId] = useState('');
    const [activeMobileTab, setActiveMobileTab] = useState('products'); 

    const searchInputRef = useRef(null);

    // --- FUZZY SEARCH (Smart Search) ---
    const fuse = useMemo(() => {
        return new Fuse(products, {
            keys: ['name', 'base_sku', 'brand_name'],
            threshold: 0.4, 
        });
    }, [products]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products.slice(0, 50); 
        return fuse.search(searchTerm).map(result => result.item);
    }, [searchTerm, products, fuse]);

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(custSearch.toLowerCase())
    );

    // --- HELPER: INVALIDATE CACHE (RESTORED) ---
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(CACHE_POS_SNAPSHOTS);
        // Hapus cache laporan & dashboard agar data sync real-time
        localStorage.removeItem('lumina_inventory_v2');
        localStorage.removeItem('lumina_dash_master_v3');
        localStorage.removeItem('lumina_sales_history_v2');
        localStorage.removeItem('lumina_balance_v2');
        localStorage.removeItem('lumina_cash_data_v2');
    };

    // --- INITIAL LOAD ---
    const loadMasterData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            if (typeof window === 'undefined') return;
            let masterData = null;
            
            // Cek Cache
            if (!forceRefresh) {
                const cachedPos = localStorage.getItem(CACHE_POS_MASTER);
                if (cachedPos) {
                    const { data, ts } = JSON.parse(cachedPos);
                    if (Date.now() - ts < CACHE_DURATION_MASTER) {
                        masterData = data;
                        setLastRefresh(new Date(ts));
                    }
                }
            }

            // Fetch jika kosong
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
                const acc = []; accS.forEach(d => acc.push({id:d.id, ...d.data()}));
                
                const vars = []; varS.forEach(d => vars.push({id:d.id, ...d.data()}));
                const prods = []; prodS.forEach(d => { 
                    const p = d.data(); 
                    const pVars = vars.filter(v => v.product_id === d.id); 
                    prods.push({ id: d.id, ...p, variants: pVars }); 
                });

                masterData = { wh, cust, acc, prods };
                localStorage.setItem(CACHE_POS_MASTER, JSON.stringify({ data: masterData, ts: Date.now() }));
                setLastRefresh(new Date());
            }

            const allowedCodes = ['1101', '1102', '1103', '1104', '1201'];
            const filteredAccounts = (masterData.acc || []).filter(a => allowedCodes.includes(String(a.code)));

            setWarehouses(masterData.wh);
            setCustomers(masterData.cust);
            setAccounts(filteredAccounts);
            setProducts(masterData.prods);

            if (!selectedWh && masterData.wh.length > 0) {
                const defWh = masterData.wh.find(w=>w.type!=='virtual_supplier')?.id || masterData.wh[0].id;
                setSelectedWh(defWh);
            }
            if (!paymentAccId) {
                const defAcc = filteredAccounts.find(a => a.code === '1103' || a.name.toLowerCase().includes('tunai')) || filteredAccounts[0]; 
                if(defAcc) setPaymentAccId(defAcc.id);
            }

            // Load Snapshots
            let stockData = {};
            const cachedSnaps = localStorage.getItem(CACHE_POS_SNAPSHOTS);
            if (!forceRefresh && cachedSnaps) {
                const { data, ts } = JSON.parse(cachedSnaps);
                if (Date.now() - ts < CACHE_DURATION_SNAPSHOTS) stockData = data;
            }

            if (Object.keys(stockData).length === 0) {
                const snapS = await getDocs(collection(db, "stock_snapshots"));
                snapS.forEach(d => stockData[d.id] = d.data().qty || 0); 
                localStorage.setItem(CACHE_POS_SNAPSHOTS, JSON.stringify({ data: stockData, ts: Date.now() }));
            }
            setSnapshots(stockData);

        } catch(e) { console.error(e); toast.error("Gagal memuat data"); } finally { setLoading(false); }
    };

    useEffect(() => { loadMasterData(); }, []);

    const handleRefresh = () => {
        const t = toast.loading("Sinkronisasi Katalog...");
        loadMasterData(true).then(() => toast.success("Katalog Terupdate!", { id: t }));
    };

    // --- LOGIC: SMART PAYMENT AUTOFILL (RESTORED) ---
    useEffect(() => {
        const selectedAcc = accounts.find(a => a.id === paymentAccId);
        if (selectedAcc) {
            const accName = selectedAcc.name.toLowerCase();
            const isCash = accName.includes('tunai');
            
            const currentTotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
            
            // Jika BUKAN Tunai (Transfer/QRIS), isi otomatis
            if (!isCash && currentTotal > 0) {
                setCashReceived(currentTotal);
            }
        }
    }, [paymentAccId, cart, accounts]);

    // --- SHORTCUTS ---
    useEffect(() => {
        const handleKey = (e) => { 
            if(e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); } 
            if(e.key === 'F9') handleCheckout(); 
            if(e.key === 'F8') setCart([]); 
        };
        window.addEventListener('keydown', handleKey); 
        return () => window.removeEventListener('keydown', handleKey);
    }, [cart, paymentAccId, cashReceived, selectedCustId, selectedWh]); 

    // --- LOGIC ---
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
                price: variant.price, cost: variant.cost || 0, qty: 1, max 
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
            if(fV) { addToCart(fV, fP.name); } 
            else if(filteredProducts.length > 0) { toast("Tekan item untuk memilih", { icon: '🔍' }); } 
            else { toast.error("Barang tidak ditemukan"); }
        }
    };

    const handleSaveCustomer = async () => {
        if(!newCustomer.name) return toast.error("Nama wajib diisi!");
        const tId = toast.loading("Menyimpan...");
        try {
            const docRef = await addDoc(collection(db, "customers"), {
                ...newCustomer, code: `CUST-${Date.now().toString().slice(-6)}`, created_at: serverTimestamp()
            });
            const newCustObj = { id: docRef.id, ...newCustomer };
            setCustomers(prev => [...prev, newCustObj]);
            setSelectedCustId(docRef.id); 
            setCustSearch(newCustomer.name);
            setModalCustomerOpen(false); setNewCustomer({ name: '', phone: '', address: '' });
            toast.success("Pelanggan dibuat!", { id: tId });
        } catch(e) { toast.error(e.message, { id: tId }); }
    };

    const handleCheckout = async () => {
        if(cart.length === 0) return toast.error("Keranjang kosong");
        const totalRevenue = cart.reduce((a,b) => a + (b.price * b.qty), 0);
        const received = parseInt(cashReceived) || 0;
        if(received < totalRevenue) return toast.error("Uang kurang!");
        
        const toastId = toast.loading("Processing...");
        try {
            const orderId = `POS-${Date.now().toString().slice(-6)}`;
            const custName = selectedCustId ? customers.find(c => c.id === selectedCustId).name : 'Guest';
            const batch = writeBatch(db);
            
            const totalCost = cart.reduce((a, b) => a + (b.cost * b.qty), 0);
            const orderItems = cart.map(i => ({
                variant_id: i.id, sku: i.sku, product_name: i.name, variant_name: i.spec,
                qty: i.qty, unit_price: i.price, unit_cost: i.cost, gross_profit_per_item: (i.price - i.cost) * i.qty
            }));

            const soRef = doc(collection(db, "sales_orders"));
            batch.set(soRef, {
                order_number: orderId, source_file: 'pos_manual',
                channel_store_name: 'POS / Kasir Toko', warehouse_id: selectedWh,
                warehouse_master_name: warehouses.find(w=>w.id===selectedWh)?.name || 'Unknown',
                customer_id: selectedCustId || null, buyer_name: custName,
                financial: { subtotal: totalRevenue, total_sales: totalRevenue, net_payout: totalRevenue, total_hpp: totalCost, gross_profit: totalRevenue - totalCost },
                operational: { status_pickup: 'completed' }, status: 'completed', payment_status: 'paid', payment_account_id: paymentAccId,
                order_date: serverTimestamp(), order_created_at: serverTimestamp(), items_preview: orderItems
            });

            for(const item of orderItems) {
                const itemRef = doc(collection(db, `sales_orders/${soRef.id}/items`));
                batch.set(itemRef, item);
                const moveRef = doc(collection(db, "stock_movements"));
                batch.set(moveRef, { variant_id: item.variant_id, warehouse_id: selectedWh, type: 'sale_out', qty: -item.qty, ref_id: soRef.id, date: serverTimestamp() });
                const snapRef = doc(db, "stock_snapshots", `${item.variant_id}_${selectedWh}`);
                batch.set(snapRef, { id: `${item.variant_id}_${selectedWh}`, variant_id: item.variant_id, warehouse_id: selectedWh, qty: increment(-item.qty) }, { merge: true });
            }
            
            const cashRef = doc(collection(db, "cash_transactions"));
            batch.set(cashRef, { type: 'in', amount: totalRevenue, date: serverTimestamp(), category: 'penjualan', account_id: paymentAccId, description: `POS ${orderId} - ${custName}`, ref_type: 'sales_order', ref_id: soRef.id });
            const accRef = doc(db, "cash_accounts", paymentAccId); 
            batch.update(accRef, { balance: increment(totalRevenue) });

            await batch.commit();
            invalidateRelatedCaches(); // CLEAN CACHE AGAR REALTIME
            
            // Local Update
            localStorage.removeItem(CACHE_POS_SNAPSHOTS);
            const newSnaps = { ...snapshots };
            cart.forEach(i => { const key = `${i.id}_${selectedWh}`; if (newSnaps[key]) newSnaps[key] -= i.qty; });
            setSnapshots(newSnaps);

            setInvoiceData({ id: orderId, total: totalRevenue, received, change: received - totalRevenue, items: cart, date: new Date(), customer: custName }); 
            setModalInvoiceOpen(true); setCart([]); setCashReceived('');
            toast.success("Transaksi Berhasil!", { id: toastId });
        } catch(e) { console.error(e); toast.error(`Gagal: ${e.message}`, { id: toastId }); }
    };

    const handlePrint = () => { window.print(); };
    const cartTotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const change = (parseInt(cashReceived) || 0) - cartTotal;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)] fade-in relative pb-20 lg:pb-0 bg-background text-text-primary">
            
            {/* MOBILE TAB SWITCHER */}
            <div className="lg:hidden flex bg-surface p-1 rounded-xl border border-border mb-2 sticky top-0 z-20 shadow-md">
                <button onClick={() => setActiveMobileTab('products')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeMobileTab === 'products' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:bg-gray-50'}`}>Katalog</button>
                <button onClick={() => setActiveMobileTab('cart')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all relative ${activeMobileTab === 'cart' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:bg-gray-50'}`}>Keranjang ({cart.length})</button>
            </div>

            {/* HIDDEN RECEIPT (PRINT AREA) */}
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

            {/* --- LEFT: PRODUCTS CATALOG --- */}
            <div className={`w-full lg:w-2/3 flex flex-col gap-4 h-full ${activeMobileTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
                
                <PageHeader 
                    title="Point of Sales" 
                    subtitle="Kasir & Transaksi Cepat"
                    actions={
                        <div className="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto">
                            {/* SEARCH BAR MODERN */}
                            <div className="relative flex-1 w-full md:w-72 group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                                </div>
                                <input 
                                    ref={searchInputRef} 
                                    type="text" 
                                    className="block w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-border rounded-xl 
                                            text-text-primary placeholder:text-text-secondary/60 shadow-sm
                                            focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" 
                                    placeholder="Cari Produk / Scan Barcode..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    onKeyDown={handleSearchEnter} 
                                />
                                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">F2</span>
                                </div>
                            </div>
                            
                            {/* REFRESH BUTTON */}
                            <button 
                                onClick={handleRefresh} 
                                className="bg-white hover:bg-gray-50 text-text-secondary hover:text-primary border border-border rounded-xl w-10 h-10 flex items-center justify-center transition-all shadow-sm hover:shadow active:scale-95"
                                title="Refresh Data"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>

                            {/* WAREHOUSE SELECT */}
                            <div className="relative">
                                <select 
                                    className="appearance-none w-full md:w-48 pl-4 pr-10 py-2.5 text-xs font-bold bg-white border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-text-primary shadow-sm cursor-pointer transition-all" 
                                    value={selectedWh} 
                                    onChange={e=>setSelectedWh(e.target.value)}
                                >
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-secondary">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                    }
                />

                {/* PRODUCT GRID (Animated) */}
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-24 lg:pb-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 content-start">
                        {loading ? <div className="col-span-full text-center py-20 text-text-secondary animate-pulse">Memuat Katalog...</div> : 
                         filteredProducts.length === 0 ? <div className="col-span-full text-center py-20 text-text-secondary flex flex-col items-center"><Package className="w-12 h-12 mb-2 opacity-20"/>Produk tidak ditemukan</div> :
                         filteredProducts.map((p, idx) => {
                            const stock = p.variants.reduce((a,b) => a + (snapshots[`${b.id}_${selectedWh}`] || 0), 0);
                            return (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    key={p.id} 
                                    onClick={() => { setSelectedProdForVariant(p); setModalVariantOpen(true); }} 
                                    className={`bg-white rounded-2xl cursor-pointer border border-border hover:border-primary hover:ring-4 hover:ring-primary/5 hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col justify-between group overflow-hidden h-full relative ${stock<=0?'opacity-60 grayscale':''}`}
                                >
                                    <div className="p-4 flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-mono font-bold text-text-secondary bg-gray-50 px-2 py-1 rounded-md border border-gray-100 tracking-tight">{p.base_sku}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${stock>0?'text-emerald-700 bg-emerald-50 border border-emerald-100':'text-rose-700 bg-rose-50 border border-rose-100'}`}>
                                                {stock}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-text-primary group-hover:text-primary leading-snug line-clamp-2 min-h-[2.5em]">
                                            {p.name}
                                        </h4>
                                    </div>
                                    <div className="px-4 py-3 bg-gray-50/80 border-t border-border flex justify-between items-center text-xs">
                                        <span className="text-text-secondary font-medium truncate max-w-[60%]">{p.brand_name}</span>
                                        <div className="flex items-center gap-1 text-primary font-bold bg-white px-2 py-0.5 rounded-md border border-border shadow-sm">
                                            <span>{p.variants.length}</span>
                                            <span className="text-[9px] uppercase text-text-secondary font-normal">Var</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </div>
            
            {/* --- RIGHT: CART PANEL (Modern) --- */}
            <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`w-full lg:w-[380px] xl:w-[420px] bg-white border-l border-border shadow-2xl flex flex-col h-full z-30 ${activeMobileTab === 'cart' ? 'fixed inset-0' : 'hidden lg:flex'}`}
            >
                <div className="p-5 border-b border-border bg-white flex justify-between items-center shrink-0 z-10">
                    <div>
                        <h3 className="font-display font-bold text-text-primary text-xl flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                            Current Order
                        </h3>
                        <p className="text-xs text-text-secondary mt-0.5 font-medium">{cart.length} items added</p>
                    </div>
                    <button 
                        onClick={()=>setCart([])} 
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 group"
                        title="Clear Cart (F8)"
                    >
                        <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        Clear
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f9fc] custom-scrollbar">
                    <AnimatePresence>
                        {cart.length === 0 ? (
                            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center h-full text-text-secondary opacity-50">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                    <ShoppingCart className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-sm font-bold text-gray-400">Keranjang Kosong</p>
                                <p className="text-xs text-gray-400 mt-1">Pilih produk untuk memulai</p>
                            </motion.div>
                        ) : cart.map((item, idx) => (
                            <motion.div 
                                key={item.id + idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-white p-3 rounded-xl border border-border shadow-sm flex flex-col gap-3 group hover:border-primary/40 transition-all duration-200"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 mr-2">
                                        <div className="text-sm font-bold text-text-primary line-clamp-2 leading-snug">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[10px] font-mono font-bold text-text-secondary bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{item.sku}</span>
                                            <span className="text-[10px] font-medium text-text-secondary bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{item.spec}</span>
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-primary font-mono bg-primary/5 px-2 py-1 rounded-lg shrink-0">
                                        {formatRupiah(item.price * item.qty)}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-100">
                                    <div className="text-[11px] text-text-secondary font-medium">@ {formatRupiah(item.price)}</div>
                                    <div className="flex items-center bg-gray-50 rounded-lg border border-border h-8 overflow-hidden shadow-sm">
                                        <button onClick={() => { const n = [...cart]; if(n[idx].qty > 1) n[idx].qty--; else n.splice(idx, 1); setCart(n); }} className="w-9 h-full flex items-center justify-center text-text-secondary hover:text-rose-500 hover:bg-rose-50 transition-colors font-bold text-lg active:bg-rose-100">-</button>
                                        <span className="text-sm font-bold w-8 text-center text-text-primary bg-white h-full flex items-center justify-center border-x border-border">{item.qty}</span>
                                        <button onClick={() => { if(item.qty < item.max) { const n = [...cart]; n[idx].qty++; setCart(n); } else { toast.error('Stok max'); } }} className="w-9 h-full flex items-center justify-center text-text-secondary hover:text-primary hover:bg-blue-50 transition-colors font-bold text-lg active:bg-blue-100">+</button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <div className="p-6 bg-white border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-40 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative z-20">
                            <div className="relative flex gap-2">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="w-4 h-4 text-text-secondary" /></div>
                                <input type="text" className="input-luxury py-2.5 pl-9 pr-8 text-xs bg-gray-50 border-border font-medium" placeholder="Pelanggan..." value={selectedCustId ? (customers.find(c=>c.id===selectedCustId)?.name) : custSearch} onChange={(e) => { setCustSearch(e.target.value); setSelectedCustId(''); setShowCustDropdown(true); }} onFocus={() => setShowCustDropdown(true)} onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)} />
                                <button onClick={()=>setModalCustomerOpen(true)} className="shrink-0 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl w-10 flex items-center justify-center transition-colors" title="Pelanggan Baru"><Plus className="w-4 h-4 stroke-[3px]" /></button>
                                {selectedCustId && <button onClick={() => { setSelectedCustId(''); setCustSearch(''); }} className="absolute right-14 top-2.5 text-text-secondary hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>}
                            </div>
                            {showCustDropdown && (
                                <div className="absolute bottom-full left-0 w-full max-h-48 overflow-y-auto bg-white border border-border rounded-t-xl shadow-xl mb-1 custom-scrollbar z-50">
                                    <div className="p-3 text-xs hover:bg-gray-50 cursor-pointer border-b border-border flex items-center gap-2" onClick={() => { setSelectedCustId(''); setCustSearch(''); setShowCustDropdown(false); }}><User className="w-3 h-3" /><span className="font-bold text-text-primary">Tamu (Guest)</span></div>
                                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (<div key={c.id} className="p-3 text-xs hover:bg-gray-50 cursor-pointer border-b border-border last:border-0" onClick={() => { setSelectedCustId(c.id); setCustSearch(c.name); setShowCustDropdown(false); }}><div className="font-bold text-text-primary">{c.name}</div>{c.phone && <div className="text-[10px] text-text-secondary">{c.phone}</div>}</div>)) : <div className="p-3 text-xs text-text-secondary text-center">Tidak ditemukan.</div>}
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><CreditCard className="w-4 h-4 text-text-secondary" /></div>
                            <select className="input-luxury py-2.5 pl-9 text-xs bg-gray-50 border-border font-medium appearance-none" value={paymentAccId} onChange={e=>setPaymentAccId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Total Tagihan</span>
                            <span className="text-3xl font-display font-bold text-text-primary tracking-tight">{formatRupiah(cartTotal)}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-xl border border-border flex flex-col gap-1">
                            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-border shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                                <span className="text-xs font-bold text-text-secondary uppercase ml-1">Uang Diterima</span>
                                <div className="flex items-center">
                                    <NumericFormat className="text-right font-bold text-text-primary bg-transparent outline-none w-40 text-xl placeholder:text-gray-300" placeholder="0" value={cashReceived} thousandSeparator="." decimalSeparator="," prefix="Rp " allowNegative={false} onValueChange={(values) => { setCashReceived(values.floatValue || ''); }} />
                                </div>
                            </div>
                            {(cashReceived > 0 || change !== 0) && (
                                <div className="flex justify-between items-center px-3 py-1">
                                    <span className="text-[10px] text-text-secondary font-medium uppercase">Kembali</span>
                                    <span className={`text-sm font-bold font-mono ${change < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{change < 0 ? `Kurang ${formatRupiah(Math.abs(change))}` : formatRupiah(change)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <button onClick={handleCheckout} className="w-full btn-gold py-4 text-sm shadow-lg shadow-accent-gold/20 hover:shadow-xl hover:shadow-accent-gold/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group">
                        <span>PROSES BAYAR (F9)</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </motion.div>

            {/* --- MODAL 1: VARIANT SELECTION (Refined) --- */}
            <Portal>
                {modalVariantOpen && selectedProdForVariant && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] border border-border overflow-hidden">
                            <div className="p-6 border-b border-border bg-gray-50 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20 uppercase tracking-wide">Select Variant</span>
                                        <span className="text-xs font-mono text-text-secondary">{selectedProdForVariant.base_sku}</span>
                                    </div>
                                    <h3 className="font-display font-bold text-text-primary text-xl">{selectedProdForVariant.name}</h3>
                                </div>
                                <button onClick={()=>setModalVariantOpen(false)} className="group bg-white p-2 rounded-xl border border-border text-text-secondary hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm">
                                    <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white text-xs font-bold text-text-secondary uppercase sticky top-0 z-10 shadow-sm">
                                        <tr><th className="pl-6 py-4 bg-gray-50 rounded-l-lg">Varian</th><th className="text-right py-4 bg-gray-50">Harga</th><th className="text-center py-4 bg-gray-50">Stok</th><th className="pr-6 text-right py-4 bg-gray-50 rounded-r-lg">Aksi</th></tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {selectedProdForVariant.variants.sort(sortBySize).map((v, i) => { 
                                            const qty = snapshots[`${v.id}_${selectedWh}`] || 0; 
                                            return (
                                                <tr key={v.id} className="border-b border-border/50 last:border-0 hover:bg-blue-50/30 transition-colors group">
                                                    <td className="pl-6 py-4">
                                                        <div className="font-medium text-text-primary">{v.color}</div>
                                                        <div className="text-xs text-text-secondary font-mono mt-0.5">{v.size}</div>
                                                    </td>
                                                    <td className="text-right font-mono font-medium text-text-primary">{formatRupiah(v.price)}</td>
                                                    <td className="text-center"><span className={`px-2.5 py-1 rounded-md text-xs font-bold ${qty>0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{qty}</span></td>
                                                    <td className="pr-6 text-right">
                                                        <button disabled={qty<=0} onClick={()=>addToCart(v, selectedProdForVariant.name)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ml-auto shadow-sm ${qty>0 ? 'bg-primary text-white hover:bg-blue-600 hover:shadow-md hover:-translate-y-0.5' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                                                            <Plus className="w-3.5 h-3.5" /> Pilih
                                                        </button>
                                                    </td>
                                                </tr> 
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                )}
            </Portal>

            {/* --- MODAL 2: INVOICE (Receipt Look) --- */}
            <Portal>
                {modalInvoiceOpen && invoiceData && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
                         <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-surface max-w-sm w-full rounded-[20px] shadow-2xl relative overflow-hidden border border-border">
                            <div className="bg-emerald-500 p-6 text-center text-white relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm"><Package className="w-8 h-8 text-white" /></div>
                                <h2 className="text-xl font-bold font-display">Transaksi Berhasil!</h2>
                                <p className="text-xs text-emerald-100 mt-1 font-mono opacity-90">{invoiceData.id}</p>
                            </div>
                            <div className="p-6 bg-white relative">
                                <div className="absolute top-0 left-0 w-full h-4 -mt-2 bg-[length:16px_16px] bg-[radial-gradient(circle,transparent_50%,#ffffff_50%)] bg-repeat-x"></div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm border-b border-dashed border-gray-200 pb-3"><span className="text-text-secondary">Customer</span><span className="font-bold text-text-primary">{invoiceData.customer}</span></div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {invoiceData.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-xs text-text-secondary"><span>{item.qty}x {item.name}</span><span className="font-mono text-text-primary">{formatRupiah(item.qty * item.price)}</span></div>
                                        ))}
                                    </div>
                                    <div className="border-t-2 border-dashed border-gray-200 pt-3 space-y-1">
                                        <div className="flex justify-between text-sm"><span className="text-text-secondary">Total Tagihan</span><span className="font-bold text-text-primary">{formatRupiah(invoiceData.total)}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-text-secondary">Tunai</span><span className="font-mono">{formatRupiah(invoiceData.received)}</span></div>
                                    </div>
                                    <div className="bg-emerald-50 rounded-lg p-3 flex justify-between items-center border border-emerald-100">
                                        <span className="text-xs font-bold text-emerald-700 uppercase">Kembali</span>
                                        <span className="text-lg font-bold text-emerald-700">{formatRupiah(Math.max(0, invoiceData.change))}</span>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-3">
                                    <button onClick={handlePrint} className="flex-1 py-3 bg-white border border-gray-200 text-text-primary hover:bg-gray-50 rounded-xl text-sm font-bold transition-colors shadow-sm">Cetak Struk</button>
                                    <button onClick={()=>setModalInvoiceOpen(false)} className="flex-1 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/30">Baru</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </Portal>

            {/* --- MODAL 3: QUICK ADD CUSTOMER (Modern Form) --- */}
            <Portal>
            {modalCustomerOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border">
                        <div className="px-6 py-5 border-b border-border bg-gray-50 flex justify-between items-center">
                            <div><h3 className="text-lg font-bold text-text-primary">Pelanggan Baru</h3><p className="text-xs text-text-secondary mt-0.5">Simpan data untuk database CRM.</p></div>
                            <button onClick={()=>setModalCustomerOpen(false)} className="text-gray-400 hover:text-rose-500 transition-colors bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-5 bg-white">
                            <div className="group"><label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Nama Lengkap</label><div className="relative"><User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" /><input className="input-luxury pl-10 bg-gray-50/50 focus:bg-white" value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer, name:e.target.value})} autoFocus placeholder="Contoh: Budi Santoso"/></div></div>
                            <div className="group"><label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">No. HP / WhatsApp</label><div className="relative"><div className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors"><Phone className="w-4 h-4"/></div><input className="input-luxury pl-10 bg-gray-50/50 focus:bg-white" value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer, phone:e.target.value})} placeholder="0812..." /></div></div>
                            <div className="group"><label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Alamat / Catatan</label><div className="relative"><MapPin className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" /><textarea className="input-luxury h-24 pl-10 pt-2.5 bg-gray-50/50 focus:bg-white resize-none" value={newCustomer.address} onChange={e=>setNewCustomer({...newCustomer, address:e.target.value})} placeholder="Alamat lengkap..." /></div></div>
                        </div>
                        <div className="p-5 border-t border-border bg-gray-50 flex justify-end gap-3">
                            <button onClick={()=>setModalCustomerOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-text-secondary hover:bg-white hover:text-rose-500 border border-transparent hover:border-border transition-all">Batal</button>
                            <button onClick={handleSaveCustomer} className="btn-gold px-6 py-2.5 shadow-lg">Simpan Pelanggan</button>
                        </div>
                    </motion.div>
                </div>
            )}
            </Portal>
        </div>
    );
}