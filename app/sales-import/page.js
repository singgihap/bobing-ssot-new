"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where, orderBy, increment } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

// Konfigurasi Cache Keys (Reuse dari halaman lain)
const CACHE_KEY_VARIANTS = 'lumina_variants_v2';
const CACHE_KEY_POS_MASTER = 'lumina_pos_master_v2';
const CACHE_KEY_INVENTORY = 'lumina_inventory_v2';
const CACHE_KEY_ACCOUNTS = 'lumina_finance_accounts_v2';
const CACHE_DURATION = 60 * 60 * 1000; // 1 Jam reuse data master

export default function ImportSalesPage() {
    const { user } = useAuth();
    const [warehouses, setWarehouses] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [config, setConfig] = useState({ warehouse_id: '', account_id: '', packing_cost: 1000 });
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (typeof window === 'undefined') return;

            // 1. Load Warehouses (Reuse Cache Inventory/POS)
            let whData = null;
            const invCache = localStorage.getItem(CACHE_KEY_INVENTORY);
            const posCache = localStorage.getItem(CACHE_KEY_POS_MASTER);

            if (invCache) {
                try { 
                    const p = JSON.parse(invCache); 
                    if (p.warehouses && p.warehouses.length > 0) whData = p.warehouses;
                } catch(e) {}
            }
            if (!whData && posCache) {
                try {
                    const p = JSON.parse(posCache);
                    if (p.data?.wh && p.data.wh.length > 0) whData = p.data.wh;
                } catch(e) {}
            }

            if (!whData) {
                // Fallback Fetch
                const whSnap = await getDocs(query(collection(db, "warehouses"), orderBy("created_at")));
                whData = []; whSnap.forEach(d => { if(d.data().type!=='virtual_supplier') whData.push({id:d.id, ...d.data()}) });
            } else {
                 // Filter jika dari cache inventory mungkin masih ada virtual
                 whData = whData.filter(d => d.type !== 'virtual_supplier');
            }
            setWarehouses(whData);

            // 2. Load Accounts (Reuse Cache Finance/POS)
            let accData = null;
            const accCache = localStorage.getItem(CACHE_KEY_ACCOUNTS);
            
            if (accCache) {
                try {
                    const p = JSON.parse(accCache);
                    if (p.data && p.data.length > 0) accData = p.data;
                } catch(e) {}
            }
            if (!accData && posCache) { // Coba dari POS
                try {
                     const p = JSON.parse(posCache);
                     if (p.data?.acc) accData = p.data.acc;
                } catch(e) {}
            }

            if (!accData) {
                // Fallback Fetch
                const accSnap = await getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")));
                accData = []; accSnap.forEach(d => accData.push({id:d.id, ...d.data()}));
            }
            
            // Filter Account Cash/Bank Only
            const filteredAcc = accData.filter(d => {
                 const c = (d.category || '').toLowerCase();
                 return c.includes('aset') || c.includes('kas') || c.includes('bank');
            });
            setAccounts(filteredAcc);
        };
        init();
    }, []);

    const addLog = (msg, type='info') => setLogs(prev => [...prev, {msg, type}]);

    // Invalidate Cache Related
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('lumina_inventory_v2');     // Stok berkurang
        localStorage.removeItem('lumina_balance_v2');       // Kas bertambah
        localStorage.removeItem('lumina_cash_data_v2');     // Saldo akun & history berubah
        localStorage.removeItem('lumina_sales_history_v2'); // History sales baru
        localStorage.removeItem('lumina_dash_master_v2');   // Dashboard KPI berubah
        localStorage.removeItem('lumina_pos_snapshots_v2'); // POS Stock berubah
        console.log("Caches invalidated.");
    };

    const getMasterVariants = async () => {
        let varMap = {};
        let loadedFromCache = false;

        // 1. Cek Cache LocalStorage (Reuse dari Variants Page)
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(CACHE_KEY_VARIANTS);
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        data.forEach(v => {
                            if(v.sku) varMap[v.sku.toUpperCase().trim()] = v;
                        });
                        addLog(`Loaded ${Object.keys(varMap).length} variants from cache.`, "success");
                        loadedFromCache = true;
                    }
                } catch(e) {}
            }
        }

        // 2. Fetch Firebase (Hanya jika cache kosong)
        if (!loadedFromCache) {
            addLog("Mengambil data master varian dari server...", "warning");
            const vSnap = await getDocs(collection(db, "product_variants"));
            const variantsArray = [];
            vSnap.forEach(d => { 
                const v=d.data(); 
                if(v.sku) {
                    const variantObj = {id:d.id, ...v};
                    varMap[v.sku.toUpperCase().trim()] = variantObj;
                    variantsArray.push(variantObj);
                } 
            });

            // Simpan Cache untuk masa depan
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY_VARIANTS, JSON.stringify({ 
                    data: variantsArray, 
                    timestamp: Date.now() 
                }));
            }
        }
        return varMap;
    };

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file || !config.warehouse_id || !config.account_id) return toast.error("Lengkapi konfigurasi gudang & akun!");

        setProcessing(true);
        setLogs([]);
        addLog("Mulai proses import...", "info");

        try {
            // 1. Master SKU (Cached)
            const varMap = await getMasterVariants();

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const wb = XLSX.read(ev.target.result, {type:'array'});
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                
                // 2. Group Orders
                const orders = {};
                rows.forEach(r => {
                    const keys = Object.keys(r);
                    const kId = keys.find(k => k.match(/nomor pesanan|order id|invoice/i));
                    const kSku = keys.find(k => k.match(/sku|product id/i));
                    if(kId && kSku && r[kId]) {
                        const id = String(r[kId]).trim();
                        if(!orders[id]) orders[id] = { items: [], raw: r };
                        orders[id].items.push(r);
                    }
                });

                // 3. Process Batch (Chunked)
                let batch = writeBatch(db);
                let count = 0;
                let opCount = 0;

                for(const [id, data] of Object.entries(orders)) {
                    const head = data.raw;
                    const ks = Object.keys(head);
                    
                    // Detect Status
                    const kStatus = ks.find(k => k.match(/status/i));
                    const statusRaw = head[kStatus]?.toLowerCase() || 'completed';
                    if(statusRaw.includes('cancel') || statusRaw.includes('batal')) { 
                        addLog(`SKIP ${id}: Status Cancelled/Batal`, "warning"); 
                        continue; 
                    }

                    // Detect Amounts
                    const kNet = ks.find(k => k.match(/settlement|penyelesaian|net/i));
                    const kGross = ks.find(k => k.match(/total|gross|subtotal/i));
                    const netAmount = parseFloat(String(head[kNet]||0).replace(/[^\d.-]/g,'')) || 0;
                    const grossAmount = parseFloat(String(head[kGross]||0).replace(/[^\d.-]/g,'')) || 0;

                    // Check Existing (Cost: 1 Read per Order)
                    // Idealnya batch check "in" query, tapi untuk import simple ini ok.
                    const qEx = query(collection(db, "sales_orders"), where("order_number", "==", id));
                    const sEx = await getDocs(qEx);
                    
                    if(!sEx.empty) {
                        const exDoc = sEx.docs[0];
                        if(exDoc.data().status !== statusRaw) {
                            batch.update(doc(db, "sales_orders", exDoc.id), { status: statusRaw, updated_at: serverTimestamp() });
                            opCount++;
                            addLog(`UPDATE ${id}: Status -> ${statusRaw}`, "info");
                        }
                    } else {
                        // Create New Order
                        const poRef = doc(collection(db, "sales_orders"));
                        const kDate = ks.find(k => k.match(/date|tanggal/i));
                        
                        // A. Header Sales Order (1 Op)
                        batch.set(poRef, {
                            order_number: id, 
                            marketplace_ref: id,
                            source: 'import',
                            warehouse_id: config.warehouse_id,
                            order_date: head[kDate] ? new Date(head[kDate]) : new Date(),
                            status: statusRaw,
                            payment_status: statusRaw === 'completed' ? 'paid' : 'unpaid',
                            gross_amount: grossAmount,
                            net_amount: netAmount || grossAmount,
                            payment_account_id: config.account_id,
                            created_at: serverTimestamp(),
                            created_by: user?.email
                        });
                        opCount++;

                        // Items
                        for (const item of data.items) {
                            const kSku = Object.keys(item).find(k => k.match(/sku/i));
                            const kQty = Object.keys(item).find(k => k.match(/qty|jumlah/i));
                            const sku = String(item[kSku]).toUpperCase().trim();
                            const qty = parseInt(item[kQty]||1);
                            
                            const v = varMap[sku];
                            if(v) {
                                // B. Sales Item (1 Op)
                                batch.set(doc(collection(db, `sales_orders/${poRef.id}/items`)), {
                                    variant_id: v.id, sku: v.sku, qty: qty, unit_price: 0, unit_cost: v.cost
                                });
                                opCount++;

                                // C. Stock Movement (1 Op)
                                batch.set(doc(collection(db, "stock_movements")), {
                                    variant_id: v.id, warehouse_id: config.warehouse_id, type: 'sale_out',
                                    qty: -qty, ref_id: poRef.id, ref_type: 'sales_order',
                                    date: serverTimestamp(), notes: `Import ${id}`
                                });
                                opCount++;

                                // D. Update Snapshot with Increment (1 Op, 0 Read)
                                const snapRef = doc(db, "stock_snapshots", `${v.id}_${config.warehouse_id}`);
                                batch.set(snapRef, {
                                    id: `${v.id}_${config.warehouse_id}`,
                                    variant_id: v.id,
                                    warehouse_id: config.warehouse_id,
                                    qty: increment(-qty) 
                                }, { merge: true });
                                opCount++;
                            }
                        };

                        // Auto Journal Cash if Completed
                        if(statusRaw === 'completed') {
                            const totalIn = netAmount || grossAmount;
                            
                            // E. Cash Transaction (1 Op)
                            const cashRef = doc(collection(db, "cash_transactions"));
                            batch.set(cashRef, {
                                type: 'in', amount: totalIn, date: serverTimestamp(),
                                category: 'penjualan', account_id: config.account_id,
                                description: `Settlement ${id}`, ref_type: 'sales_order', ref_id: poRef.id
                            });
                            opCount++;

                            // F. Update Account Balance (1 Op, 0 Read)
                            const accRef = doc(db, "cash_accounts", config.account_id);
                            batch.update(accRef, {
                                balance: increment(totalIn)
                            });
                            opCount++;
                        }

                        count++;
                        addLog(`NEW ${id}: Created`, "success");
                    }

                    // Chunking Batch (Limit 500 operations)
                    if (opCount >= 450) {
                        await batch.commit();
                        batch = writeBatch(db);
                        opCount = 0;
                        addLog("...Menyimpan batch data...", "warning");
                    }
                }

                // Commit sisa
                if (opCount > 0) await batch.commit();
                
                invalidateRelatedCaches();
                addLog(`SELESAI! Proses ${count} order baru.`, "success");
                toast.success("Import Sales Berhasil!");
                setProcessing(false);
            };
            reader.readAsArrayBuffer(file);

        } catch(e) { console.error(e); addLog(`ERROR: ${e.message}`, "error"); setProcessing(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in pb-20">
            <div className="card-luxury p-8 bg-lumina-surface border-lumina-border">
                <h2 className="text-xl md:text-3xl font-display font-bold text-lumina-text mb-6">
                    Import Sales Report (Marketplace)
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Source Warehouse</label>
                        <select className="input-luxury" value={config.warehouse_id} onChange={e=>setConfig({...config, warehouse_id:e.target.value})}>
                            <option value="">Select Warehouse</option>
                            {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-lumina-gold uppercase mb-1">Settlement Wallet</label>
                        <select className="input-luxury border-lumina-gold/50 text-lumina-gold" value={config.account_id} onChange={e=>setConfig({...config, account_id:e.target.value})}>
                            <option value="">Select Wallet</option>
                            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Packing Cost (Optional)</label>
                        <input type="number" className="input-luxury" value={config.packing_cost} onChange={e=>setConfig({...config, packing_cost:e.target.value})} />
                    </div>
                </div>

                <div className="border-2 border-dashed border-lumina-border rounded-xl p-8 text-center bg-lumina-base/50 hover:bg-lumina-base transition-colors cursor-pointer relative group">
                    <input type="file" accept=".xlsx, .csv" onChange={handleFile} disabled={processing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="pointer-events-none relative z-0">
                        <div className="w-12 h-12 bg-lumina-highlight rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-lumina-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </div>
                        <p className="text-sm font-bold text-lumina-text">Upload Sales Report (Excel)</p>
                        <p className="text-xs text-lumina-muted mt-1">Supported: Desty, Shopee, Tokopedia Format</p>
                    </div>
                </div>
            </div>

            {/* Console Log */}
            <div className="bg-[#0B0C10] p-4 rounded-xl border border-lumina-border h-64 overflow-y-auto font-mono text-xs shadow-inner">
                <div className="flex items-center gap-2 mb-3 border-b border-lumina-border pb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-lumina-muted ml-2">Import Terminal</span>
                </div>
                <div className="space-y-1">
                    {logs.length === 0 ? (
                        <span className="text-lumina-muted/50 animate-pulse">System ready...</span>
                    ) : logs.map((l,i) => (
                        <div key={i} className={`flex gap-2 ${l.type==='error'?'text-rose-400':(l.type==='warning'?'text-amber-400':(l.type==='success'?'text-emerald-400':'text-lumina-muted'))}`}>
                            <span className="opacity-50 select-none">{'>'}</span>
                            <span>{l.msg}</span>
                        </div>
                    ))}
                    {processing && <div className="text-lumina-gold animate-pulse mt-2">_ Processing data...</div>}
                </div>
            </div>
        </div>
    );
}