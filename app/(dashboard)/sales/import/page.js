"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, orderBy, increment, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { formatRupiah } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import Link from 'next/link';

// --- MODERN UI IMPORTS ---
import { 
    UploadCloud, FileSpreadsheet, RefreshCw, AlertTriangle, CheckCircle, 
    X, AlertCircle, Save, Building, CreditCard, ArrowRight, Trash2, Box 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Cache Keys
const CACHE_KEY_VARIANTS = 'lumina_variants_v2';
const CACHE_KEY_PRODUCTS_BASE = 'lumina_products_base_v2';

export default function ImportSalesPage() {
    const { user } = useAuth();
    
    // --- STATE CONFIG & DATA ---
    const [warehouses, setWarehouses] = useState([]);
    const [accounts, setAccounts] = useState([]); 
    const [config, setConfig] = useState({ warehouse_id: '', account_id: '' });
    
    // --- STATE PROCESS ---
    const [rawFile, setRawFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [step, setStep] = useState(1); 
    const [previewData, setPreviewData] = useState(null); 
    const [validationIssues, setValidationIssues] = useState([]);
    const [lastRefresh, setLastRefresh] = useState(null);

    // --- STATE MODALS ---
    const [activeModal, setActiveModal] = useState(null);
    const [modalForm, setModalForm] = useState({});

    // --- INITIAL LOAD ---
    useEffect(() => {
        const init = async () => {
            if (typeof window === 'undefined') return;

            const [whSnap, accSnap] = await Promise.all([
                getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")))
            ]);

            const whList = []; 
            whSnap.forEach(d => { if(d.data().type !== 'virtual_supplier') whList.push({id:d.id, ...d.data()}) });
            setWarehouses(whList);

            const accList = []; 
            accSnap.forEach(d => { 
                const c = (d.data().category || '').toLowerCase();
                if(c.includes('piutang') || c.includes('receivable') || c.includes('aset')) accList.push({id:d.id, ...d.data()});
            });
            setAccounts(accList);
            
            const defWh = whList.find(w => w.name.toLowerCase().includes('utama')) || whList[0];
            const defAcc = accList.find(a => a.name.toLowerCase().includes('piutang usaha')) || accList[0];
            setConfig({ warehouse_id: defWh ? defWh.id : '', account_id: defAcc ? defAcc.id : '' });
        };
        init();
    }, []);

    // --- LOGIC: MASTER DATA ---
    const getMasterData = async (forceRefresh = false) => {
        let varMap = {};
        let baseMap = {};
        
        if (!forceRefresh) {
            const cachedVar = localStorage.getItem(CACHE_KEY_VARIANTS);
            const cachedBase = localStorage.getItem(CACHE_KEY_PRODUCTS_BASE);
            if (cachedVar && cachedBase) {
                const pv = JSON.parse(cachedVar);
                const pb = JSON.parse(cachedBase);
                if (Date.now() - pv.ts < 3600000) {
                    pv.data.forEach(v => { if(v.sku) varMap[v.sku.toUpperCase().trim()] = v; });
                    baseMap = pb.data;
                    return { varMap, baseMap };
                }
            }
        }

        const [vSnap, pSnap] = await Promise.all([
            getDocs(collection(db, "product_variants")),
            getDocs(collection(db, "products"))
        ]);

        const vList = [];
        vSnap.forEach(d => { 
            const v=d.data(); 
            if(v.sku) {
                const item = {id:d.id, ...v};
                varMap[v.sku.toUpperCase().trim()] = item;
                vList.push(item);
            }
        });

        pSnap.forEach(d => {
            const p = d.data();
            if(p.base_sku) baseMap[p.base_sku.toUpperCase().trim()] = {id:d.id, name:p.name};
        });

        localStorage.setItem(CACHE_KEY_VARIANTS, JSON.stringify({ data: vList, ts: Date.now() }));
        localStorage.setItem(CACHE_KEY_PRODUCTS_BASE, JSON.stringify({ data: baseMap, ts: Date.now() }));
        
        return { varMap, baseMap };
    };

    const parseMoney = (val) => parseFloat(String(val || 0).replace(/[^\d.-]/g,'')) || 0;

    // --- HELPER: FIND KEY ---
    const findKey = (obj, ...keywords) => {
        const keys = Object.keys(obj);
        return keys.find(k => keywords.every(kw => k.includes(kw))) || '';
    };

    // --- LOGIC: PROCESS FILE ---
    const processFile = async (fileObj) => {
        if (!fileObj) return;
        setProcessing(true);
        try {
            const { varMap, baseMap } = await getMasterData();
            const reader = new FileReader();
            
            reader.onload = async (ev) => {
                const wb = XLSX.read(ev.target.result, {type:'array'});
                const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

                const rows = rawRows.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ").trim().toLowerCase();
                        newRow[cleanKey] = row[key];
                    });
                    return newRow;
                });

                const orders = {};
                rows.forEach((r) => {
                    const idDesty = String(r['nomor pesanan (di desty)'] || '').trim();
                    const idMP = String(r['nomor pesanan (di marketplace)'] || '').trim();
                    const mainId = idDesty || idMP;
                    if(mainId) {
                        if(!orders[mainId]) orders[mainId] = { items: [], raw: r };
                        orders[mainId].items.push(r);
                    }
                });

                const processedOrders = [];
                const issues = [];
                let totalHPP = 0;
                let totalSales = 0;

                for(const [id, data] of Object.entries(orders)) {
                    const head = data.raw;
                    const orderItems = [];
                    let orderHPP = 0;

                    for(const item of data.items) {
                        const skuMaster = String(item['sku master'] || '').toUpperCase().trim();
                        const skuMP = String(item['sku marketplace'] || '').toUpperCase().trim();
                        const skuTarget = (skuMaster || skuMP || '').toUpperCase().trim();
                        
                        let v = varMap[skuTarget];
                        if(!v && skuMP) v = varMap[skuMP.toUpperCase().trim()];

                        // Validation Logic
                        if(!v) {
                            const baseParts = skuTarget.split('-');
                            const potentialBase = baseParts[0];
                            const baseProd = baseMap[potentialBase];
                            if (baseProd) {
                                issues.push({ 
                                    type: 'variant_missing', severity: 'error', orderId: id, sku: skuTarget, 
                                    productId: baseProd.id, productName: baseProd.name,
                                    msg: `Varian belum ada (Induk: ${baseProd.name})` 
                                });
                            } else {
                                issues.push({ type: 'product_missing', severity: 'error', orderId: id, sku: skuTarget, msg: `Produk Baru (Belum ada di Master)` });
                            }
                        } else {
                            const masterCost = parseFloat(v.cost || 0);
                            const xlsxHPP = parseMoney(item['hpp']); 

                            if (xlsxHPP === 0) issues.push({ type: 'hpp_xlsx_zero', severity: 'warning', orderId: id, sku: v.sku, msg: `HPP Excel 0` });
                            if (xlsxHPP > 0 && xlsxHPP !== masterCost) issues.push({ type: 'hpp_mismatch', severity: 'warning', orderId: id, sku: v.sku, msg: `Selisih HPP` });
                            if (isNaN(masterCost) || masterCost <= 0) issues.push({ type: 'hpp_zero', severity: 'error', orderId: id, sku: v.sku, productId: v.product_id, variantId: v.id, msg: `HPP Master Masih 0` });
                        }

                        const qty = parseMoney(item['jumlah']);
                        
                        let netPrice = parseMoney(item['harga dibayar']);
                        let listPrice = parseMoney(item['harga satuan']) || parseMoney(item['harga awal produk']);
                        
                        if (netPrice === 0 && qty > 0) netPrice = parseMoney(item['subtotal produk']) / qty;
                        if (listPrice === 0) listPrice = netPrice;

                        const unitCost = v ? (parseFloat(v.cost) || 0) : 0;
                        orderHPP += (unitCost * qty);
                        
                        orderItems.push({
                            variant_id: v?.id || 'unknown',
                            sku: skuTarget,
                            product_name: item['nama produk'] || 'Unknown',
                            variant_name: item['varian produk'] || '-',
                            qty, 
                            unit_price: netPrice,
                            original_price: listPrice,
                            unit_cost: unitCost,
                            gross_profit_per_item: (netPrice - unitCost) * qty
                        });
                    }

                    const keyPayment = findKey(head, 'metode', 'pembayaran') || 'metode pembayaran';
                    const keyPhone = findKey(head, 'nomor', 'telepon') || 'nomor telepon pembeli';
                    const keyResi = findKey(head, 'nomor', 'resi') || findKey(head, 'nomor', 'awb') || 'nomor awb/resi';
                    
                    const actualPayout = parseMoney(head['penyelesaian pembayaran']) || parseMoney(head['total penjualan']);

                    totalSales += actualPayout;
                    totalHPP += orderHPP;

                    processedOrders.push({
                        id, head, items: orderItems,
                        keys: { keyPayment, keyPhone, keyResi },
                        financial: { 
                            netPayout: actualPayout, 
                            totalHPP: orderHPP, 
                            grossProfit: actualPayout - orderHPP,
                            affiliate: 0 
                        }
                    });
                }

                setPreviewData({ orders: processedOrders, totalSales, totalHPP });
                const sortedIssues = issues.sort((a,b) => (a.severity === 'error' ? -1 : 1));
                setValidationIssues(sortedIssues);
                setStep(2); 
                setProcessing(false);
            };
            reader.readAsArrayBuffer(fileObj);
        } catch(e) {
            console.error(e);
            toast.error("Error Processing: " + e.message);
            setProcessing(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file || !config.warehouse_id || !config.account_id) return toast.error("Lengkapi konfigurasi dulu!");
        setRawFile(file);
        processFile(file);
    };

    const handleRefreshAndRevalidate = async () => {
        const tId = toast.loading("Sinkronisasi & Validasi Ulang...");
        try {
            await getMasterData(true);
            setLastRefresh(new Date());
            if (rawFile) {
                await processFile(rawFile);
                toast.success("Data Master & Validasi Updated!", { id: tId });
            } else {
                toast.success("Data Master Updated!", { id: tId });
            }
        } catch(e) {
            toast.error("Gagal refresh", { id: tId });
        }
    };

    // --- MODAL LOGIC ---
    const openCreateModal = (sku) => {
        const parts = sku.split('-');
        let prefill = { base_sku: sku, name: '', color: '', size: '', price: 0, cost: 0 };
        if (parts.length >= 3) { prefill.base_sku = parts[0]; prefill.color = parts[1]; prefill.size = parts.slice(2).join('-'); } 
        else if (parts.length === 2) { prefill.base_sku = parts[0]; prefill.size = parts[1]; }
        setModalForm(prefill);
        setActiveModal('create_product');
    };

    const openEditVariantModal = (issue) => {
        setModalForm({
            mode: issue.type === 'variant_missing' ? 'add' : 'edit',
            product_id: issue.productId,
            variant_id: issue.variantId || null,
            sku: issue.sku,
            color: issue.sku.split('-')[1] || '',
            size: issue.sku.split('-')[2] || '',
            cost: 0, price: 0
        });
        setActiveModal('edit_variant');
    };

    const handleSaveModal = async () => {
        const tId = toast.loading("Menyimpan...");
        try {
            if (activeModal === 'create_product') {
                const pRef = await addDoc(collection(db, "products"), {
                    name: modalForm.name, base_sku: modalForm.base_sku.toUpperCase(),
                    brand_name: '', category_name: '', created_at: serverTimestamp(), updated_at: serverTimestamp()
                });
                await addDoc(collection(db, "product_variants"), {
                    product_id: pRef.id,
                    sku: modalForm.base_sku.toUpperCase() + (modalForm.color?`-${modalForm.color}`:'') + (modalForm.size?`-${modalForm.size}`:''),
                    color: modalForm.color, size: modalForm.size,
                    cost: Number(modalForm.cost), price: Number(modalForm.price),
                    status: 'active', created_at: serverTimestamp()
                });
            } else if (activeModal === 'edit_variant') {
                if (modalForm.mode === 'edit') {
                    await updateDoc(doc(db, "product_variants", modalForm.variant_id), { cost: Number(modalForm.cost), updated_at: serverTimestamp() });
                } else {
                    await addDoc(collection(db, "product_variants"), {
                        product_id: modalForm.product_id, sku: modalForm.sku,
                        color: modalForm.color, size: modalForm.size,
                        cost: Number(modalForm.cost), price: Number(modalForm.price),
                        status: 'active', created_at: serverTimestamp()
                    });
                }
            }
            toast.success("Berhasil disimpan!", { id: tId });
            setActiveModal(null);
            handleRefreshAndRevalidate(); 
        } catch(e) {
            console.error(e);
            toast.error("Gagal simpan: " + e.message, { id: tId });
        }
    };

    const handleCommit = async () => {
        if(validationIssues.some(i => i.severity === 'error')) return toast.error("Perbaiki ERROR sebelum menyimpan!");
        if(validationIssues.some(i => i.severity === 'warning') && !confirm("Ada Warning (Kuning). Lanjut simpan?")) return;
        
        setProcessing(true);
        try {
            let batch = writeBatch(db);
            let opCount = 0;

            for(const order of previewData.orders) {
                const { id, head, items, financial, keys } = order;
                const statusRaw = String(head['status pesanan'] || '').toLowerCase();
                const poRef = doc(collection(db, "sales_orders"));
                
                const orderPayload = {
                    order_id_desty: id,
                    order_id_marketplace: head['nomor pesanan (di marketplace)'] || '',
                    order_number: head['nomor pesanan (di marketplace)'] || id, 
                    source_file: 'import_desty',
                    channel_store_name: head['channel - nama toko'] || 'Unknown',
                    warehouse_id: config.warehouse_id,
                    warehouse_master_name: head['nama gudang master'] || '', 
                    buyer_name: head['nama pembeli'] || 'Guest',
                    buyer_phone: head[keys.keyPhone] || '', 
                    buyer_email: head['email pembeli'] || '',
                    buyer_address: head['alamat pembeli'] || '', 
                    payment_method: head[keys.keyPayment] || 'Unknown',
                    financial: {
                        subtotal: parseMoney(head['subtotal produk']),
                        discount: parseMoney(head['diskon penjual']) || parseMoney(head['total diskon']), 
                        refund: parseMoney(head['refund']), 
                        shipping_fee: parseMoney(head['biaya pengiriman final']) || parseMoney(head['ongkos kirim']), 
                        service_fee: parseMoney(head['biaya layanan']),
                        tax: parseMoney(head['pajak']),
                        affiliate_commission: 0, 
                        total_sales: parseMoney(head['total penjualan']),
                        net_payout: financial.netPayout, 
                        total_hpp: financial.totalHPP,
                        gross_profit: financial.grossProfit,
                        currency: 'IDR'
                    },
                    operational: {
                        courier: head['kurir'] || '',
                        awb_number: head[keys.keyResi] || head['no. resi'] || '', 
                        ship_before: head['dikirim sebelum'] ? new Date(head['dikirim sebelum']) : null
                    },
                    status: statusRaw,
                    status_internal: ['selesai', 'completed', 'delivered'].some(s => statusRaw.includes(s)) ? 'completed' : 'processing',
                    payment_status: 'unpaid', payment_account_id: config.account_id,
                    order_created_at: head['tanggal pesanan'] ? new Date(head['tanggal pesanan']) : serverTimestamp(),
                    marketplace_created_at: head['tanggal pesanan'] ? new Date(head['tanggal pesanan']) : null,
                    imported_at: serverTimestamp(),
                    items_preview: items 
                };

                batch.set(poRef, orderPayload);
                opCount++;

                for(const item of items) {
                    const itemRef = doc(collection(db, `sales_orders/${poRef.id}/items`));
                    batch.set(itemRef, item);
                    opCount++;
                    if(item.variant_id !== 'unknown') {
                        const moveRef = doc(collection(db, "stock_movements"));
                        batch.set(moveRef, {
                            variant_id: item.variant_id, warehouse_id: config.warehouse_id, 
                            type: 'sale_out', qty: -item.qty, ref_id: poRef.id, ref_type: 'sales_order_import', date: serverTimestamp()
                        });
                        opCount++;
                        const snapRef = doc(db, "stock_snapshots", `${item.variant_id}_${config.warehouse_id}`);
                        batch.set(snapRef, { id: `${item.variant_id}_${config.warehouse_id}`, variant_id: item.variant_id, warehouse_id: config.warehouse_id, qty: increment(-item.qty) }, { merge: true });
                        opCount++;
                    }
                }
                if(opCount >= 400) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
            }
            if(opCount > 0) await batch.commit();
            
            localStorage.removeItem('lumina_inventory_v2'); 
            toast.success("Import Selesai! Data Estimasi Piutang tersimpan.");
            setStep(1); setPreviewData(null); setValidationIssues([]); setProcessing(false); setRawFile(null);

        } catch(e) { toast.error("Gagal post: " + e.message); setProcessing(false); }
    };

    const handleResetDatabase = async () => {
        if(!confirm("⚠️ YAKIN HAPUS SEMUA DATA PENJUALAN?")) return;
        const userInput = prompt("Ketik 'DELETE' untuk konfirmasi:");
        if(userInput !== 'DELETE') return;
        setProcessing(true);
        try {
            const q = query(collection(db, "sales_orders"));
            const snapshot = await getDocs(q);
            const batches = [];
            let batch = writeBatch(db);
            let count = 0;
            for (const d of snapshot.docs) {
                batch.delete(doc(db, "sales_orders", d.id));
                count++;
                if (count >= 400) { batches.push(batch.commit()); batch = writeBatch(db); count = 0; }
            }
            if (count > 0) batches.push(batch.commit());
            await Promise.all(batches);
            toast.success("Database BERSIH!");
            setProcessing(false);
        } catch (e) { toast.error(e.message); setProcessing(false); }
    };

    // Reusable Metric Card
    const MetricCard = ({ title, value, colorClass, icon: Icon }) => (
        <div className={`p-5 rounded-xl border border-border bg-white shadow-sm flex items-center justify-between`}>
            <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">{title}</p>
                <h3 className={`text-2xl font-display font-bold ${colorClass}`}>{value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-gray-50 text-text-secondary border border-border`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            <PageHeader 
                title="Import Sales (SSOT)" 
                subtitle="Upload data penjualan marketplace, validasi HPP, dan posting otomatis." 
            />

            {/* CONFIG CARD */}
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden">
                {step === 1 && <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>}
                
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Warehouse Config */}
                    <div className="flex-1">
                        <label className="text-xs font-bold text-text-secondary uppercase mb-2 flex items-center gap-2">
                            <Building className="w-4 h-4"/> Gudang Stok
                        </label>
                        <div className="relative">
                            <select 
                                className="input-luxury appearance-none cursor-pointer" 
                                value={config.warehouse_id} 
                                onChange={e=>setConfig({...config, warehouse_id:e.target.value})} 
                                disabled={step===2}
                            >
                                <option value="">-- Pilih Gudang --</option>
                                {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none text-text-secondary"><ArrowRight className="w-4 h-4 rotate-90"/></div>
                        </div>
                    </div>

                    {/* Account Config */}
                    <div className="flex-1">
                        <label className="text-xs font-bold text-text-secondary uppercase mb-2 flex items-center gap-2">
                            <CreditCard className="w-4 h-4"/> Akun Piutang
                        </label>
                        <div className="relative">
                            <select 
                                className="input-luxury appearance-none cursor-pointer" 
                                value={config.account_id} 
                                onChange={e=>setConfig({...config, account_id:e.target.value})} 
                                disabled={step===2}
                            >
                                <option value="">-- Pilih Akun --</option>
                                {accounts.map(a=><option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none text-text-secondary"><ArrowRight className="w-4 h-4 rotate-90"/></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* STEP 1: UPLOAD AREA */}
            {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-text-primary">Upload File</h3>
                        <button onClick={()=>handleRefreshAndRevalidate()} className="text-xs bg-white hover:bg-gray-50 border border-border px-3 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-text-primary font-medium">
                            <RefreshCw className={`w-3.5 h-3.5 ${processing?'animate-spin':''}`} /> 
                            Refresh Master {lastRefresh && <span className="opacity-50 text-[10px]">({lastRefresh.toLocaleTimeString()})</span>}
                        </button>
                    </div>
                    
                    <div className="border-2 border-dashed border-border hover:border-primary/50 bg-white hover:bg-primary/5 rounded-2xl p-12 text-center transition-all relative group cursor-pointer">
                        <input type="file" accept=".xlsx, .csv" onChange={handleFileChange} disabled={processing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                        <div className="pointer-events-none relative z-10 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
                                <UploadCloud className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-bold text-text-primary">Drag & Drop atau Klik Upload</h4>
                            <p className="text-sm text-text-secondary max-w-sm mx-auto">
                                Gunakan format export Excel standar dari Desty. Pastikan konfigurasi gudang sudah benar.
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-text-secondary bg-gray-100 px-3 py-1.5 rounded-lg border border-border">
                                <FileSpreadsheet className="w-3 h-3" /> Supported: .xlsx, .csv
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: PREVIEW & VALIDATION */}
            {step === 2 && previewData && (
                <div className="space-y-8 animate-slide-up">
                    {/* Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard title="Total Orders" value={previewData.orders.length} colorClass="text-text-primary" icon={FileSpreadsheet} />
                        <MetricCard title="Est. Piutang" value={formatRupiah(previewData.totalSales)} colorClass="text-emerald-600" icon={CreditCard} />
                        <MetricCard title="Total HPP" value={formatRupiah(previewData.totalHPP)} colorClass="text-rose-500" icon={Box} />
                    </div>

                    {/* Validation Panel */}
                    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-text-primary flex items-center gap-2">
                                {validationIssues.length > 0 ? (
                                    <><AlertTriangle className="w-5 h-5 text-amber-500"/> Validasi Diperlukan ({validationIssues.length})</>
                                ) : (
                                    <><CheckCircle className="w-5 h-5 text-emerald-500"/> Data Valid & Siap Posting</>
                                )}
                            </h3>
                            {validationIssues.length === 0 && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Ready</span>}
                        </div>

                        {validationIssues.length > 0 ? (
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-0">
                                {validationIssues.map((issue, i) => {
                                    const isError = issue.severity === 'error';
                                    return (
                                        <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-border last:border-0 hover:bg-gray-50 transition-colors gap-3 ${isError ? 'bg-rose-50/30' : ''}`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isError ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-bold font-mono text-text-primary">{issue.sku}</span>
                                                        <span className="text-[10px] text-text-secondary bg-white border border-border px-1.5 rounded">Order {issue.orderId}</span>
                                                    </div>
                                                    <p className={`text-xs font-medium ${isError ? 'text-rose-600' : 'text-amber-600'}`}>{issue.msg}</p>
                                                </div>
                                            </div>
                                            
                                            {/* Fix Actions */}
                                            <div className="shrink-0">
                                                {issue.type === 'product_missing' && (
                                                    <button onClick={()=>openCreateModal(issue.sku)} className="text-xs bg-white border border-primary text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm">
                                                        + Buat Produk
                                                    </button>
                                                )}
                                                {(issue.type === 'variant_missing' || issue.type === 'hpp_zero') && (
                                                    <button onClick={()=>openEditVariantModal(issue)} className="text-xs bg-white border border-indigo-500 text-indigo-600 hover:bg-indigo-500 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm">
                                                        ✏️ Fix Varian
                                                    </button>
                                                )}
                                                {(issue.type === 'hpp_xlsx_zero' || issue.type === 'hpp_mismatch') && (
                                                    <span className="text-[10px] text-text-secondary italic bg-gray-100 px-2 py-1 rounded">Cek Master vs Excel</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center flex flex-col items-center justify-center text-text-secondary/50">
                                <CheckCircle className="w-12 h-12 mb-3 text-emerald-100" />
                                <p className="text-sm font-medium text-text-secondary">Tidak ada masalah ditemukan.</p>
                            </div>
                        )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex gap-4 pt-4 border-t border-border">
                        <button 
                            onClick={() => { setStep(1); setPreviewData(null); setRawFile(null); }} 
                            className="btn-ghost-dark px-6 py-3"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={handleCommit} 
                            disabled={processing || validationIssues.some(i => i.severity === 'error')} 
                            className={`btn-gold flex-1 py-3 text-sm shadow-lg ${validationIssues.some(i=>i.severity==='error') ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 shadow-none' : ''}`}
                        >
                            {processing ? 'Menyimpan...' : 'POSTING KE PEMBUKUAN'}
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODAL 1: CREATE PRODUCT (SIMPLE) --- */}
            <Portal>
            {activeModal === 'create_product' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-0 border border-border overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-text-primary">🆕 Buat Produk Baru</h3>
                            <button onClick={()=>setActiveModal(null)}><X className="w-5 h-5 text-text-secondary hover:text-rose-500"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div><label className="text-xs font-bold text-text-secondary mb-1 block">Nama Produk</label><input className="input-luxury" value={modalForm.name} onChange={e=>setModalForm({...modalForm, name:e.target.value})} autoFocus placeholder="Contoh: Kemeja Flanel"/></div>
                            <div><label className="text-xs font-bold text-text-secondary mb-1 block">Base SKU (Induk)</label><input className="input-luxury font-mono uppercase" value={modalForm.base_sku} onChange={e=>setModalForm({...modalForm, base_sku:e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-text-secondary mb-1 block">Warna</label><input className="input-luxury" value={modalForm.color} onChange={e=>setModalForm({...modalForm, color:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-text-secondary mb-1 block">Ukuran</label><input className="input-luxury" value={modalForm.size} onChange={e=>setModalForm({...modalForm, size:e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-border">
                                <div><label className="text-xs font-bold text-emerald-600 mb-1 block">Harga Jual</label><input type="number" className="input-luxury border-emerald-200 text-emerald-600 font-bold" value={modalForm.price} onChange={e=>setModalForm({...modalForm, price:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-rose-500 mb-1 block">HPP (Modal)</label><input type="number" className="input-luxury border-rose-200 text-rose-500 font-bold" value={modalForm.cost} onChange={e=>setModalForm({...modalForm, cost:e.target.value})}/></div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-border flex justify-end gap-3">
                            <button onClick={()=>setActiveModal(null)} className="btn-ghost-dark text-xs">Batal</button>
                            <button onClick={handleSaveModal} className="btn-gold px-6">Simpan & Validasi</button>
                        </div>
                    </motion.div>
                </div>
            )}
            </Portal>

            {/* --- MODAL 2: EDIT VARIANT / HPP --- */}
            <Portal>
            {activeModal === 'edit_variant' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                    <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-0 border border-border overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-text-primary">{modalForm.mode==='edit' ? '✏️ Edit HPP Varian' : '➕ Tambah Varian'}</h3>
                            <button onClick={()=>setActiveModal(null)}><X className="w-5 h-5 text-text-secondary hover:text-rose-500"/></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-blue-50 p-3 rounded-lg text-xs border border-blue-100 text-blue-800">
                                <span className="opacity-70">Target SKU:</span> <span className="font-mono font-bold block text-sm">{modalForm.sku}</span>
                            </div>
                            {modalForm.mode === 'add' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold text-text-secondary mb-1 block">Warna</label><input className="input-luxury" value={modalForm.color} onChange={e=>setModalForm({...modalForm, color:e.target.value})}/></div>
                                    <div><label className="text-xs font-bold text-text-secondary mb-1 block">Ukuran</label><input className="input-luxury" value={modalForm.size} onChange={e=>setModalForm({...modalForm, size:e.target.value})}/></div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-rose-500 mb-1 block uppercase">HPP (Modal) *Wajib</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-rose-300 font-bold">Rp</span>
                                    <input type="number" className="input-luxury pl-10 border-rose-200 text-rose-600 font-bold text-lg" value={modalForm.cost} onChange={e=>setModalForm({...modalForm, cost:e.target.value})} autoFocus/>
                                </div>
                            </div>
                            {modalForm.mode === 'add' && (
                                <div><label className="text-xs font-bold text-emerald-600 mb-1 block">Harga Jual</label><input type="number" className="input-luxury border-emerald-200" value={modalForm.price} onChange={e=>setModalForm({...modalForm, price:e.target.value})}/></div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-border flex justify-end gap-3">
                            <button onClick={()=>setActiveModal(null)} className="btn-ghost-dark text-xs">Batal</button>
                            <button onClick={handleSaveModal} className="btn-gold px-6">Simpan</button>
                        </div>
                    </motion.div>
                </div>
            )}
            </Portal>

            {/* --- DEV RESET BUTTON --- */}
            <div className="mt-12 text-center opacity-30 hover:opacity-100 transition-opacity">
                <button onClick={handleResetDatabase} className="text-[10px] text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1 mx-auto">
                    <Trash2 className="w-3 h-3"/> DEV: RESET DATABASE
                </button>
            </div>
        </div>
    );
}