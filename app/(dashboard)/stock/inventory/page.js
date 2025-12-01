"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

// 👇 TAMBAHKAN INI (YANG HILANG SEBELUMNYA)
import { Portal } from '@/lib/usePortal'; 

// COMPONENTS
import InventoryTable from './components/InventoryTable';
import InventoryCardList from './components/InventoryCardList';
import AdjustmentModal from './components/AdjustmentModal';
import StockCardModal from './components/StockCardModal';
import PurchaseDraftDrawer from './components/PurchaseDraftDrawer';
import FinalizePoModal from './components/FinalizePoModal';

// UI
import { Search, RotateCcw, ChevronDown, ShoppingCart, Filter, Warehouse } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// SERVICES
import { recordAdjustmentTransaction, recordPurchaseTransaction } from '@/lib/transactionService';
import { getCache, setCache, invalidateSmart, CACHE_KEYS, DURATION } from '@/lib/cacheManager';

export default function InventoryPage() {
    // STATE
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [collections, setCollections] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    const [loading, setLoading] = useState(true);

    // FILTERS
    const [searchTerm, setSearchTerm] = useState('');
    const [filterWarehouse, setFilterWarehouse] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterCollection, setFilterCollection] = useState('all');
    const [expandedProductId, setExpandedProductId] = useState(null);

    // ACTIONS
    const [poCart, setPoCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    
    // MODALS
    const [modalAdjOpen, setModalAdjOpen] = useState(false);
    const [modalCardOpen, setModalCardOpen] = useState(false);
    const [modalFinalizeOpen, setModalFinalizeOpen] = useState(false);
    
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [adjForm, setAdjForm] = useState({ qty: 0, notes: '', type: 'opname' });
    const [poForm, setPoForm] = useState({ supplier_id: '', warehouse_id: '', date: new Date().toISOString().split('T')[0] });
    const [cardData, setCardData] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // 1. Cek Cache
            if (!forceRefresh) {
                const cachedData = getCache(CACHE_KEYS.INVENTORY, DURATION.MEDIUM);
                if (cachedData) {
                    setProducts(cachedData.products);
                    setWarehouses(cachedData.warehouses);
                    setCategories(cachedData.categories || []);
                    setCollections(cachedData.collections || []);
                    setSnapshots(cachedData.snapshots);
                    fetchSuppliers(); // Suppliers ringan, fetch terpisah
                    setLoading(false);
                    return;
                }
            }

            // 2. Fetch Firebase
            const [prodSnap, whSnap, snapSnap, varSnap, catSnap, colSnap] = await Promise.all([
                getDocs(collection(db, "products")),
                getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                getDocs(collection(db, "stock_snapshots")),
                getDocs(collection(db, "product_variants")),
                getDocs(query(collection(db, "categories"), orderBy("name"))),
                getDocs(query(collection(db, "collections"), orderBy("name")))
            ]);

            const variantsMap = {}; 
            varSnap.forEach(d => {
                const v = { id: d.id, ...d.data() };
                if(!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
                variantsMap[v.product_id].push(v);
            });

            const prods = [];
            prodSnap.forEach(d => {
                const p = d.data();
                if(variantsMap[d.id]) prods.push({ id: d.id, ...p, variants: variantsMap[d.id] });
            });

            const snapMap = {}; snapSnap.forEach(d => snapMap[d.id] = d.data().qty || 0);
            const whs = whSnap.docs.map(d => ({id:d.id, ...d.data()}));
            const cats = catSnap.docs.map(d => ({id:d.id, ...d.data()}));
            const cols = colSnap.docs.map(d => ({id:d.id, ...d.data()}));

            setProducts(prods); setWarehouses(whs); setCategories(cats); setCollections(cols); setSnapshots(snapMap);
            fetchSuppliers();

            // 3. Simpan Cache
            setCache(CACHE_KEYS.INVENTORY, { 
                products: prods, warehouses: whs, categories: cats, collections: cols, snapshots: snapMap 
            });

        } catch(e) { console.error(e); toast.error("Gagal memuat inventory"); } 
        finally { setLoading(false); }
    };

    const fetchSuppliers = async () => {
        const snap = await getDocs(query(collection(db, "suppliers"), orderBy("name")));
        setSuppliers(snap.docs.map(d => ({id:d.id, ...d.data()})));
    };

    const handleRefresh = () => {
        const t = toast.loading("Menyegarkan data...");
        fetchData(true).then(() => toast.success("Inventory Terupdate!", { id: t }));
    };

    // --- LOGIC HELPER & ACTIONS ---
    const getCategoryFamily = (parentId, allCats) => {
        let ids = [parentId];
        allCats.filter(c => c.parent_id === parentId).forEach(child => ids = [...ids, ...getCategoryFamily(child.id, allCats)]);
        return ids;
    };

    const filteredProducts = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.base_sku?.toLowerCase().includes(searchTerm.toLowerCase());
        let matchCat = true;
        if(filterCategory !== 'all') {
            const familyIds = getCategoryFamily(filterCategory, categories);
            matchCat = familyIds.includes(p.category_id);
        }
        const matchCol = filterCollection === 'all' || p.collection_id === filterCollection;
        return matchSearch && matchCat && matchCol;
    });

    const displayedWarehouses = filterWarehouse === 'all' ? warehouses : warehouses.filter(w => w.id === filterWarehouse);

    const getFilteredAssetValue = () => {
        let totalVal = 0;
        filteredProducts.forEach(p => {
            p.variants.forEach(v => {
                let qty = filterWarehouse === 'all' ? warehouses.reduce((acc,w) => acc+(snapshots[`${v.id}_${w.id}`]||0),0) : snapshots[`${v.id}_${filterWarehouse}`]||0;
                totalVal += qty * (v.cost||0);
            });
        });
        return totalVal;
    };

    const addToPoCart = (variant, product) => {
        setPoCart(prev => {
            const existing = prev.find(i => i.variant_id === variant.id);
            if (existing) { toast.success('Qty Updated', { icon: '➕' }); return prev.map(i => i.variant_id === variant.id ? { ...i, qty: i.qty + 1 } : i); }
            toast.success('Added to Draft PO', { icon: '🛒' });
            return [...prev, { variant_id: variant.id, sku: variant.sku, product_name: product.name, variant_name: `${variant.color} / ${variant.size}`, qty: 1, cost: variant.cost || 0 }];
        });
    };

    const openAdjustment = (variant, whId) => {
        const currentQty = snapshots[`${variant.id}_${whId}`] || 0;
        setSelectedVariant({ ...variant, warehouse_id: whId, current_qty: currentQty });
        setAdjForm({ qty: currentQty, notes: '', type: 'opname' });
        setModalAdjOpen(true);
    };

    const handleSaveAdjustment = async () => {
        if (!selectedVariant) return;
        const tId = toast.loading("Saving...");
        try {
            const settingSnap = await getDoc(doc(db, "settings", "general"));
            const financeConfig = settingSnap.exists() ? settingSnap.data().financeConfig : null;
            const { id: variantId, warehouse_id } = selectedVariant;
            const targetQty = parseInt(adjForm.qty);
            const diff = targetQty - selectedVariant.current_qty;
            const totalValue = Math.abs(diff * (selectedVariant.cost || 0));

            await runTransaction(db, async (t) => {
                const moveRef = doc(collection(db, "stock_movements"));
                t.set(moveRef, { variant_id: variantId, warehouse_id: warehouse_id, type: adjForm.type === 'opname' ? 'adjustment_opname' : 'adjustment_in', qty: diff, date: serverTimestamp(), notes: adjForm.notes || 'Manual Adj', created_by: 'admin' });
                const snapRef = doc(db, "stock_snapshots", `${variantId}_${warehouse_id}`);
                t.set(snapRef, { id: `${variantId}_${warehouse_id}`, variant_id: variantId, warehouse_id: warehouse_id, qty: targetQty, updated_at: serverTimestamp() }, { merge: true });
                if (diff < 0 && financeConfig && totalValue > 0) recordAdjustmentTransaction(db, t, { refId: moveRef.id, totalValue: totalValue, type: 'loss', financeConfig: financeConfig });
            });

            // Update Cache & State
            const newSnaps = { ...snapshots, [`${variantId}_${warehouse_id}`]: targetQty };
            setSnapshots(newSnaps);
            
            const cached = getCache(CACHE_KEYS.INVENTORY, DURATION.MEDIUM);
            if (cached) setCache(CACHE_KEYS.INVENTORY, { ...cached, snapshots: newSnaps });

            if (diff < 0) invalidateSmart('TRANSACTION');

            toast.success("Saved!", { id: tId });
            setModalAdjOpen(false);
        } catch (e) { toast.error(e.message, { id: tId }); }
    };

    const handleFinalizePO = async () => {
        if(!poForm.supplier_id || !poForm.warehouse_id) return toast.error("Pilih Supplier & Gudang");
        const tId = toast.loading("Creating PO...");
        try {
            const sSnap = await getDoc(doc(db, "settings", "general"));
            const fConfig = sSnap.exists() ? sSnap.data().financeConfig : null;
            const totalAmt = poCart.reduce((a,b) => a+(b.qty*b.cost), 0);
            const supName = suppliers.find(s=>s.id===poForm.supplier_id)?.name || 'Unknown';

            await runTransaction(db, async (t) => {
                const poRef = doc(collection(db, "purchase_orders"));
                t.set(poRef, { supplier_name: supName, warehouse_id: poForm.warehouse_id, order_date: new Date(poForm.date), status: 'received_full', total_amount: totalAmt, total_qty: poCart.reduce((a,b)=>a+b.qty,0), payment_status: 'unpaid', created_at: serverTimestamp(), source: 'inventory_quick_po' });
                
                poCart.forEach(item => {
                    const iRef = doc(collection(db, `purchase_orders/${poRef.id}/items`));
                    t.set(iRef, { variant_id: item.variant_id, qty: item.qty, unit_cost: item.cost, subtotal: item.qty*item.cost });
                    const mRef = doc(collection(db, "stock_movements"));
                    t.set(mRef, { variant_id: item.variant_id, warehouse_id: poForm.warehouse_id, type: 'purchase_in', qty: item.qty, ref_id: poRef.id, date: serverTimestamp(), notes: `Quick PO` });
                    const sKey = `${item.variant_id}_${poForm.warehouse_id}`;
                    const sRef = doc(db, "stock_snapshots", sKey);
                    const curQty = snapshots[sKey] || 0;
                    t.set(sRef, { id: sKey, variant_id: item.variant_id, warehouse_id: poForm.warehouse_id, qty: curQty + item.qty }, { merge: true });
                });

                if(fConfig) recordPurchaseTransaction(db, t, { poId: poRef.id, totalAmount: totalAmt, isPaid: false, walletId: null, supplierName: supName, financeConfig: fConfig });
            });
            
            invalidateSmart('PURCHASE');

            setPoCart([]); setModalFinalizeOpen(false); setIsCartOpen(false); fetchData(true);
            toast.success("PO Created!", { id: tId });
        } catch(e) { toast.error("Gagal", { id: tId }); }
    };

    const openStockCard = async (variant, whId) => {
        setCardData(null); 
        setModalCardOpen(true);
        setSelectedVariant({ ...variant, warehouse_id: whId });
        try {
            const q = query(collection(db, "stock_movements"), where("variant_id", "==", variant.id), where("warehouse_id", "==", whId), orderBy("date", "desc"), limit(20));
            const snap = await getDocs(q);
            setCardData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { toast.error("Gagal load history"); setCardData([]); }
    };

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 text-text-primary bg-background min-h-screen relative">
            <PageHeader title="Inventory Management" subtitle="Real-time stock monitoring." actions={
                <div className="flex gap-3 items-center">
                    <button onClick={() => setIsCartOpen(true)} className="bg-white border border-border text-text-primary p-2.5 rounded-xl shadow-sm hover:bg-gray-50 relative group hidden md:block" title="Open Draft PO"><ShoppingCart className="w-5 h-5" />{poCart.length > 0 && (<span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-sm animate-bounce">{poCart.length}</span>)}</button>
                    <button onClick={handleRefresh} className="bg-white border border-border p-2.5 rounded-xl shadow-sm hover:bg-gray-50"><RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
            }/>

            <div className="bg-white p-4 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full"><Search className="w-4 h-4 text-text-secondary absolute left-3 top-3"/><input type="text" className="w-full pl-10 py-2.5 text-sm bg-gray-50 border border-border rounded-xl focus:outline-none focus:border-primary" placeholder="Cari Produk / SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="relative min-w-[140px]"><Warehouse className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-500"/><select value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)} className="w-full pl-9 pr-8 py-2.5 text-xs font-bold bg-white border border-border rounded-xl appearance-none"><option value="all">Semua Gudang</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><ChevronDown className="w-3.5 h-3.5 absolute right-3 top-3 pointer-events-none"/></div>
                    <div className="relative min-w-[140px]"><Filter className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-500"/><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full pl-9 pr-8 py-2.5 text-xs font-bold bg-white border border-border rounded-xl appearance-none"><option value="all">Semua Kategori</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown className="w-3.5 h-3.5 absolute right-3 top-3 pointer-events-none"/></div>
                </div>
            </div>

            <InventoryCardList loading={loading} products={filteredProducts} warehouses={displayedWarehouses} snapshots={snapshots} expandedProductId={expandedProductId} setExpandedProductId={setExpandedProductId} onAddToCart={addToPoCart} onOpenAdjustment={openAdjustment} />
            <InventoryTable loading={loading} products={filteredProducts} warehouses={displayedWarehouses} snapshots={snapshots} expandedProductId={expandedProductId} setExpandedProductId={setExpandedProductId} onAddToCart={addToPoCart} onOpenAdjustment={openAdjustment} onOpenHistory={openStockCard} totalAssetValue={getFilteredAssetValue()} />

            <AnimatePresence>
                {poCart.length > 0 && (<motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => setIsCartOpen(true)} className="md:hidden fixed bottom-20 right-6 z-40 bg-primary text-white p-4 rounded-full shadow-2xl hover:bg-blue-600 flex items-center justify-center"><ShoppingCart className="w-6 h-6" /><span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-white font-bold">{poCart.length}</span></motion.button>)}
            </AnimatePresence>

            <Portal>
                <PurchaseDraftDrawer isOpen={isCartOpen} onClose={()=>setIsCartOpen(false)} cart={poCart} onRemove={(idx)=>setPoCart(p=>p.filter((_,i)=>i!==idx))} onOpenFinalize={()=>setModalFinalizeOpen(true)} />
                <AdjustmentModal isOpen={modalAdjOpen} onClose={()=>setModalAdjOpen(false)} variant={selectedVariant} onSave={handleSaveAdjustment} form={adjForm} setForm={setAdjForm} />
                <StockCardModal isOpen={modalCardOpen} onClose={()=>setModalCardOpen(false)} variant={selectedVariant} history={cardData} />
                <FinalizePoModal isOpen={modalFinalizeOpen} onClose={()=>setModalFinalizeOpen(false)} onSubmit={handleFinalizePO} suppliers={suppliers} warehouses={warehouses} form={poForm} setForm={setPoForm} />
            </Portal>
        </div>
    );
}