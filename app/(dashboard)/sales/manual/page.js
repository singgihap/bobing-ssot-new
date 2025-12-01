"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, query, orderBy, serverTimestamp, increment, writeBatch, addDoc, getDoc } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast'; 
import { useAuth } from '@/context/AuthContext';
import { recordSalesTransaction } from '@/lib/transactionService';

// --- IMPORT COMPONENTS ---
import CatalogPanel from './components/CatalogPanel';
import CartPanel from './components/CartPanel';
import VariantModal from './components/VariantModal';
import SuccessModal from './components/SuccessModal';
import { User, MapPin, Phone, X } from 'lucide-react';
import { motion } from 'framer-motion';

// --- NEW: CACHE MANAGER UTILITY ---
import { 
    getCache, 
    setCache, 
    invalidateCache, 
    invalidateSmart, 
    CACHE_KEYS, 
    DURATION 
} from '@/lib/cacheManager';

export default function PosPage() {
    const { user } = useAuth();

    // --- DATA STATE ---
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [collections, setCollections] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    
    // --- UI STATE ---
    const [loading, setLoading] = useState(true);
    const [selectedWh, setSelectedWh] = useState('');
    const [activeMobileTab, setActiveMobileTab] = useState('products');
    
    // --- CART STATE ---
    const [cart, setCart] = useState([]);
    const [selectedCustId, setSelectedCustId] = useState('');
    const [paymentAccId, setPaymentAccId] = useState('');
    const [cashReceived, setCashReceived] = useState('');

    // --- MODAL STATE ---
    const [modalVariantOpen, setModalVariantOpen] = useState(false);
    const [selectedProdForVariant, setSelectedProdForVariant] = useState(null);
    const [modalInvoiceOpen, setModalInvoiceOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    const [modalCustomerOpen, setModalCustomerOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });

    // 1. Load Data (Updated with Cache Manager)
    const loadMasterData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            if (typeof window === 'undefined') return;
            
            let masterData = null;
            let stockData = {};

            // A. Cek Cache Master Data (POS Master)
            if (!forceRefresh) {
                masterData = getCache(CACHE_KEYS.POS_MASTER, DURATION.MEDIUM); // 30 Menit
            }

            // B. Jika Cache Kosong, Fetch dari Firebase
            if (!masterData) {
                const [whS, prodS, varS, custS, accS, catS, colS] = await Promise.all([
                    getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                    getDocs(collection(db, "products")), 
                    getDocs(query(collection(db, "product_variants"), orderBy("sku"))),
                    getDocs(query(collection(db, "customers"), orderBy("name"))),
                    getDocs(query(collection(db, "chart_of_accounts"), orderBy("code"))),
                    getDocs(query(collection(db, "categories"), orderBy("name"))),
                    getDocs(query(collection(db, "collections"), orderBy("name")))
                ]);

                const wh = whS.docs.map(d => ({id:d.id, ...d.data()}));
                const cust = custS.docs.map(d => ({id:d.id, ...d.data()}));
                const acc = accS.docs.map(d => ({id:d.id, ...d.data()}));
                const cats = catS.docs.map(d => ({id:d.id, ...d.data()}));
                const cols = colS.docs.map(d => ({id:d.id, ...d.data()}));
                
                const vars = varS.docs.map(d => ({id:d.id, ...d.data()}));
                const prods = prodS.docs.map(d => { 
                    const p = d.data(); 
                    const pVars = vars.filter(v => v.product_id === d.id); 
                    return { id: d.id, ...p, variants: pVars }; 
                });

                masterData = { wh, cust, acc, prods, cats, cols };
                
                // Simpan ke Cache
                setCache(CACHE_KEYS.POS_MASTER, masterData);
            }

            // Set State Master Data
            setWarehouses(masterData.wh);
            setCustomers(masterData.cust);
            // Filter akun kas/bank
            setAccounts((masterData.acc || []).filter(a => 
                ['1101', '1102', '1103', '1104', '1201'].includes(String(a.code)) || 
                (a.category && a.category.includes('ASET'))
            ));
            setProducts(masterData.prods);
            setCategories(masterData.cats || []);
            setCollections(masterData.cols || []);

            // Setup Default Selection
            if (!selectedWh && masterData.wh.length > 0) {
                const defWh = masterData.wh.find(w=>w.type!=='virtual_supplier')?.id || masterData.wh[0].id;
                setSelectedWh(defWh);
            }
            if (!paymentAccId && masterData.acc.length > 0) {
                const defAcc = masterData.acc.find(a => a.code === '1103' || a.name.toLowerCase().includes('tunai'));
                if(defAcc) setPaymentAccId(defAcc.id);
            }

            // C. Snapshots Stok (Cache Terpisah, Durasi Pendek)
            if (!forceRefresh) {
                stockData = getCache(CACHE_KEYS.SNAPSHOTS, DURATION.SHORT) || {}; // 5 Menit
            }

            if (Object.keys(stockData).length === 0) {
                const snapS = await getDocs(collection(db, "stock_snapshots"));
                snapS.forEach(d => stockData[d.id] = d.data().qty || 0); 
                setCache(CACHE_KEYS.SNAPSHOTS, stockData);
            }
            setSnapshots(stockData);

        } catch(e) { 
            console.error(e); 
            toast.error("Gagal memuat data"); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { loadMasterData(); }, []);

    // 2. Cart Logic (Sama seperti sebelumnya)
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
            setCart([...cart, { id: variant.id, sku: variant.sku, name: prodName, spec: `${variant.color}/${variant.size}`, price: variant.price, cost: variant.cost || 0, qty: 1, max }]); 
        }
        setModalVariantOpen(false); 
        toast.success("Item +1", { duration: 800, icon: '🛒' });
    };

    const updateCartQty = (idx, delta) => {
        const n = [...cart];
        if (n[idx].qty + delta > n[idx].max) return toast.error('Stok Max');
        if (n[idx].qty + delta < 1) n.splice(idx, 1);
        else n[idx].qty += delta;
        setCart(n);
    };

    // 3. Checkout Logic (Updated with Cache Invalidation)
    const handleCheckout = async () => {
        if(cart.length === 0) return toast.error("Keranjang kosong");
        const totalRevenue = cart.reduce((a,b) => a + (b.price * b.qty), 0);
        const received = parseInt(cashReceived) || 0;
        if(received < totalRevenue) return toast.error("Uang kurang!");
        if(!paymentAccId) return toast.error("Pilih metode pembayaran");
        
        const tId = toast.loading("Processing...");
        try {
            // Finance Config
            let financeConfig = { defaultRevenueId: '4101', defaultInventoryId: '1301', defaultCOGSId: '5101' };
            const sSnap = await getDoc(doc(db, "settings", "general"));
            if(sSnap.exists()) financeConfig = sSnap.data().financeConfig || financeConfig;

            const orderId = `POS-${Date.now().toString().slice(-6)}`;
            const custName = selectedCustId ? customers.find(c => c.id === selectedCustId).name : 'Guest';
            const batch = writeBatch(db);
            const totalCost = cart.reduce((a, b) => a + (b.cost * b.qty), 0);
            
            const orderItems = cart.map(i => ({
                variant_id: i.id, sku: i.sku, product_name: i.name, variant_name: i.spec,
                qty: i.qty, unit_price: i.price, unit_cost: i.cost, gross_profit_per_item: (i.price - i.cost) * i.qty
            }));

            // Create Order
            const soRef = doc(collection(db, "sales_orders"));
            batch.set(soRef, {
                order_number: orderId, source_file: 'pos_manual', channel_store_name: 'POS / Kasir Toko', 
                warehouse_id: selectedWh, customer_id: selectedCustId || null, buyer_name: custName,
                financial: { subtotal: totalRevenue, total_sales: totalRevenue, net_payout: totalRevenue, total_hpp: totalCost, gross_profit: totalRevenue - totalCost },
                operational: { status_pickup: 'completed' }, status: 'completed', payment_status: 'paid', payment_account_id: paymentAccId,
                order_date: serverTimestamp(), items_preview: orderItems
            });

            // Update Stock & Logs
            for(const item of orderItems) {
                const itemRef = doc(collection(db, `sales_orders/${soRef.id}/items`));
                batch.set(itemRef, item);
                const moveRef = doc(collection(db, "stock_movements"));
                batch.set(moveRef, { variant_id: item.variant_id, warehouse_id: selectedWh, type: 'sale_out', qty: -item.qty, ref_id: soRef.id, date: serverTimestamp() });
                const snapRef = doc(db, "stock_snapshots", `${item.variant_id}_${selectedWh}`);
                batch.set(snapRef, { id: `${item.variant_id}_${selectedWh}`, variant_id: item.variant_id, warehouse_id: selectedWh, qty: increment(-item.qty) }, { merge: true });
            }

            // Finance Journal
            recordSalesTransaction(db, batch, { orderId, totalRevenue, totalCost, walletId: paymentAccId, financeConfig, userEmail: user?.email });

            await batch.commit();
            
            // --- CLEANUP CACHE OTOMATIS ---
            // Membersihkan cache Inventory, Snapshots, History Sales, Transaksi, Dashboard
            invalidateSmart('TRANSACTION');
            
            // Local Update (Optimistic UI)
            const newSnaps = { ...snapshots };
            cart.forEach(i => { const k = `${i.id}_${selectedWh}`; if(newSnaps[k]) newSnaps[k] -= i.qty; });
            setSnapshots(newSnaps);
            setCache(CACHE_KEYS.SNAPSHOTS, newSnaps); // Update cache lokal snapshot langsung

            setInvoiceData({ id: orderId, total: totalRevenue, received, change: received - totalRevenue, items: cart, date: new Date(), customer: custName }); 
            setModalInvoiceOpen(true); setCart([]); setCashReceived('');
            toast.success("Transaksi Berhasil!", { id: tId });

        } catch(e) { console.error(e); toast.error(`Gagal: ${e.message}`, { id: tId }); }
    };

    const handleSaveCustomer = async () => {
        if(!newCustomer.name) return toast.error("Nama wajib diisi!");
        const tId = toast.loading("Menyimpan...");
        try {
            const ref = await addDoc(collection(db, "customers"), { ...newCustomer, code: `CUST-${Date.now().toString().slice(-6)}`, created_at: serverTimestamp() });
            const newCustObj = { id: ref.id, ...newCustomer };
            
            setCustomers(prev => [...prev, newCustObj]);
            setSelectedCustId(ref.id); 
            
            // Invalidate Cache Pelanggan agar sync
            invalidateCache([CACHE_KEYS.CUSTOMERS, CACHE_KEYS.POS_MASTER]);
            
            setModalCustomerOpen(false); setNewCustomer({ name: '', phone: '', address: '' });
            toast.success("Pelanggan dibuat!", { id: tId });
        } catch(e) { toast.error("Gagal simpan", { id: tId }); }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)] fade-in relative pb-20 lg:pb-0 bg-background text-text-primary">
            
            {/* MOBILE TABS */}
            <div className="lg:hidden flex bg-white p-1 rounded-xl border border-border mb-2 sticky top-0 z-20 shadow-sm">
                <button onClick={() => setActiveMobileTab('products')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeMobileTab === 'products' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:bg-gray-50'}`}>Katalog</button>
                <button onClick={() => setActiveMobileTab('cart')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all relative ${activeMobileTab === 'cart' ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:bg-gray-50'}`}>Keranjang ({cart.length})</button>
            </div>

            {/* LEFT: CATALOG */}
            <div className={`w-full lg:w-2/3 h-full ${activeMobileTab === 'products' ? 'block' : 'hidden lg:block'}`}>
                <CatalogPanel 
                    products={products} categories={categories} collections={collections} warehouses={warehouses}
                    selectedWh={selectedWh} setSelectedWh={setSelectedWh}
                    snapshots={snapshots} cart={cart}
                    onSelectProduct={(p) => { setSelectedProdForVariant(p); setModalVariantOpen(true); }}
                    onRefresh={() => loadMasterData(true)} loading={loading}
                />
            </div>

            {/* RIGHT: CART */}
            <CartPanel 
                cart={cart} customers={customers} accounts={accounts}
                onUpdateQty={updateCartQty} onRemove={(i) => updateCartQty(i, -9999)} onClear={() => setCart([])}
                onCheckout={handleCheckout}
                selectedCustId={selectedCustId} setSelectedCustId={setSelectedCustId}
                paymentAccId={paymentAccId} setPaymentAccId={setPaymentAccId}
                cashReceived={cashReceived} setCashReceived={setCashReceived}
                onOpenCustomerModal={() => setModalCustomerOpen(true)}
                activeMobileTab={activeMobileTab} setActiveMobileTab={setActiveMobileTab}
            />

            {/* MODALS */}
            <Portal>
                {modalVariantOpen && <VariantModal product={selectedProdForVariant} snapshots={snapshots} selectedWh={selectedWh} onClose={()=>setModalVariantOpen(false)} onAddToCart={addToCart} />}
                {modalInvoiceOpen && <SuccessModal data={invoiceData} onClose={()=>setModalInvoiceOpen(false)} onPrint={()=>window.print()} />}
                
                {modalCustomerOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border">
                            <div className="px-6 py-5 border-b border-border bg-gray-50 flex justify-between items-center">
                                <div><h3 className="text-lg font-bold text-text-primary">Pelanggan Baru</h3></div>
                                <button onClick={()=>setModalCustomerOpen(false)} className="bg-white p-1 rounded hover:text-rose-500 shadow-sm"><X className="w-5 h-5"/></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1"><label className="text-xs font-bold text-text-secondary uppercase">Nama</label><div className="relative"><User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/><input className="input-luxury pl-9" value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer, name:e.target.value})} autoFocus/></div></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-text-secondary uppercase">No HP</label><div className="relative"><Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/><input className="input-luxury pl-9" value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer, phone:e.target.value})}/></div></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-text-secondary uppercase">Alamat</label><div className="relative"><MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/><textarea className="input-luxury pl-9" value={newCustomer.address} onChange={e=>setNewCustomer({...newCustomer, address:e.target.value})}/></div></div>
                                <button onClick={handleSaveCustomer} className="w-full btn-gold py-3 shadow-md mt-4">Simpan</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </Portal>
        </div>
    );
}