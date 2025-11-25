"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where, orderBy, increment } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

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
    const [config, setConfig] = useState({ warehouse_id: '', account_id: '', packing_cost: 0 });
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (typeof window === 'undefined') return;

            // 1. Load Warehouses & Accounts (Logic sama seperti sebelumnya, disingkat)
            let whData = null, accData = null;
            // ... (Kode load cache warehouse/account sama persis) ...
            // Supaya aman saya pakai fallback fetch simple saja di sini
            
            const whSnap = await getDocs(query(collection(db, "warehouses"), orderBy("created_at")));
            const whList = []; whSnap.forEach(d => { if(d.data().type!=='virtual_supplier') whList.push({id:d.id, ...d.data()}) });
            setWarehouses(whList);

            const accSnap = await getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")));
            const accList = []; 
            accSnap.forEach(d => { 
                const c = (d.data().category || '').toLowerCase();
                if(c.includes('aset') || c.includes('kas') || c.includes('bank')) accList.push({id:d.id, ...d.data()});
            });
            setAccounts(accList);
        };
        init();
    }, []);

    const addLog = (msg, type='info') => setLogs(prev => [...prev, {msg, type}]);

    // Invalidate Cache
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('lumina_inventory_v2');
        localStorage.removeItem('lumina_balance_v2');
        localStorage.removeItem('lumina_cash_data_v2');
        localStorage.removeItem('lumina_sales_history_v2');
        localStorage.removeItem('lumina_dash_master_v2');
        localStorage.removeItem('lumina_pos_snapshots_v2');
    };

    const getMasterVariants = async () => {
        let varMap = {};
        const cached = localStorage.getItem(CACHE_KEY_VARIANTS);
        if (cached) {
             try { 
                 const { data } = JSON.parse(cached);
                 data.forEach(v => { if(v.sku) varMap[v.sku.toUpperCase().trim()] = v; });
                 return varMap;
             } catch(e){}
        }
        
        // Fallback
        const vSnap = await getDocs(collection(db, "product_variants"));
        vSnap.forEach(d => { 
            const v=d.data(); 
            if(v.sku) varMap[v.sku.toUpperCase().trim()] = {id:d.id, ...v}; 
        });
        return varMap;
    };

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file || !config.warehouse_id || !config.account_id) return toast.error("Lengkapi konfigurasi gudang & akun!");

        setProcessing(true);
        setLogs([]);
        addLog("Mulai proses import...", "info");

        try {
            const varMap = await getMasterVariants();
            const reader = new FileReader();
            
            reader.onload = async (ev) => {
                const wb = XLSX.read(ev.target.result, {type:'array'});
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(sheet);

                // --- 1. NORMALIZE HEADERS (Kunci Utama Fix Desty) ---
                const normalizeRow = (row) => {
                    const newRow = {};
                    Object.keys(row).forEach(key => {
                        // Hapus newline, spasi ganda, dan trim
                        const cleanKey = key.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ").trim().toLowerCase();
                        newRow[cleanKey] = row[key];
                    });
                    return newRow;
                };
                const rows = rawRows.map(normalizeRow);

                addLog(`Terbaca ${rows.length} baris data.`, "info");

                // --- 2. GROUPING ORDERS ---
                const orders = {};
                rows.forEach(r => {
                    // Mapping Kolom Desty (Sesuai CSV User)
                    // "nomor pesanan (di desty)" atau "nomor pesanan (di marketplace)"
                    const idDesty = r['nomor pesanan (di desty)'];
                    const idMP = r['nomor pesanan (di marketplace)'];
                    const id = String(idDesty || idMP || '').trim();

                    if(id) {
                        if(!orders[id]) orders[id] = { items: [], raw: r };
                        orders[id].items.push(r);
                    }
                });

                // --- 3. PROCESS BATCH ---
                let batch = writeBatch(db);
                let opCount = 0;
                let successCount = 0;

                for(const [id, data] of Object.entries(orders)) {
                    const head = data.raw;
                    const statusRaw = String(head['status pesanan'] || '').toLowerCase();

                    if(statusRaw.includes('batal') || statusRaw.includes('cancel')) continue;

                    // Parsing Nilai Uang
                    const parseMoney = (val) => parseFloat(String(val || 0).replace(/[^\d.-]/g,'')) || 0;
                    
                    // Desty: "Total Penjualan" = Net yang diterima seller
                    // "Subtotal Produk" = Gross Sales
                    // "Penyelesaian Pembayaran" = Uang cair (biasanya di Shopee)
                    const grossAmount = parseMoney(head['subtotal produk']);
                    const netAmount = parseMoney(head['penyelesaian pembayaran']) || parseMoney(head['total penjualan']);

                    const paymentStatus = ['completed', 'selesai', 'in_delivery', 'delivered'].some(s => statusRaw.includes(s)) ? 'paid' : 'unpaid';

                    // Check Existing
                    const qEx = query(collection(db, "sales_orders"), where("order_number", "==", id));
                    const sEx = await getDocs(qEx);

                    if(!sEx.empty) {
                        // Update Status Only
                        const exDoc = sEx.docs[0];
                        if(exDoc.data().status !== statusRaw) {
                            batch.update(doc(db, "sales_orders", exDoc.id), { status: statusRaw, updated_at: serverTimestamp() });
                            opCount++;
                        }
                    } else {
                        // New Order
                        const poRef = doc(collection(db, "sales_orders"));
                        const dateStr = head['tanggal pesanan dibuat'];
                        const orderDate = dateStr ? new Date(dateStr) : new Date();

                        batch.set(poRef, {
                            order_number: id,
                            marketplace_ref: head['nomor pesanan (di marketplace)'] || id,
                            source: `import_${head['channel - nama toko'] || 'desty'}`,
                            warehouse_id: config.warehouse_id,
                            order_date: orderDate,
                            status: statusRaw,
                            payment_status: paymentStatus,
                            gross_amount: grossAmount,
                            net_amount: netAmount,
                            payment_account_id: config.account_id,
                            customer_name: head['nama pembeli'] || 'Guest',
                            shipping_address: head['alamat pembeli'] || '',
                            created_at: serverTimestamp(),
                            created_by: user?.email
                        });
                        opCount++;

                        // Items
                        for(const item of data.items) {
                            const skuMaster = String(item['sku master'] || '').toUpperCase().trim();
                            const skuMP = String(item['sku marketplace'] || '').toUpperCase().trim();
                            
                            let v = varMap[skuMaster];
                            if(!v && skuMP) v = varMap[skuMP];

                            const qty = parseMoney(item['jumlah']);
                            
                            if(v) {
                                batch.set(doc(collection(db, `sales_orders/${poRef.id}/items`)), {
                                    variant_id: v.id, sku: v.sku, qty, unit_price: 0, unit_cost: v.cost || 0
                                });
                                opCount++;

                                // Stock Movement & Snapshot
                                batch.set(doc(collection(db, "stock_movements")), {
                                    variant_id: v.id, warehouse_id: config.warehouse_id, type: 'sale_out',
                                    qty: -qty, ref_id: poRef.id, ref_type: 'sales_order', date: serverTimestamp(), notes: `Import ${id}`
                                });
                                opCount++;

                                const snapRef = doc(db, "stock_snapshots", `${v.id}_${config.warehouse_id}`);
                                batch.set(snapRef, {
                                    id: `${v.id}_${config.warehouse_id}`, variant_id: v.id, warehouse_id: config.warehouse_id,
                                    qty: increment(-qty)
                                }, { merge: true });
                                opCount++;
                            }
                        }

                        // Auto Cash Journal (Jika Paid)
                        if(paymentStatus === 'paid' && netAmount > 0) {
                            const cashRef = doc(collection(db, "cash_transactions"));
                            batch.set(cashRef, {
                                type: 'in', amount: netAmount, date: serverTimestamp(),
                                category: 'penjualan', account_id: config.account_id,
                                description: `Settlement ${id}`, ref_type: 'sales_order', ref_id: poRef.id
                            });
                            opCount++;

                            const accRef = doc(db, "cash_accounts", config.account_id);
                            batch.update(accRef, { balance: increment(netAmount) });
                            opCount++;
                        }
                        successCount++;
                    }

                    // Batch Limit Handling
                    if(opCount >= 400) {
                        await batch.commit();
                        batch = writeBatch(db);
                        opCount = 0;
                        addLog("Saving partial batch...", "warning");
                    }
                }

                if(opCount > 0) await batch.commit();
                
                invalidateRelatedCaches();
                addLog(`SELESAI! ${successCount} order baru diproses.`, "success");
                toast.success("Import Selesai");
                setProcessing(false);
            };
            reader.readAsArrayBuffer(file);

        } catch(e) {
            console.error(e);
            addLog("Error: " + e.message, "error");
            setProcessing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in pb-20">
            <PageHeader title="Import Sales" subtitle="Upload laporan penjualan dari Desty/Marketplace." />

            <div className="card-luxury p-8 bg-lumina-surface border-lumina-border">
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
                        <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Packing Cost</label>
                        <input type="number" className="input-luxury" value={config.packing_cost} onChange={e=>setConfig({...config, packing_cost:e.target.value})} />
                    </div>
                </div>

                <div className="border-2 border-dashed border-lumina-border rounded-xl p-8 text-center bg-lumina-base/50 hover:bg-lumina-base transition-colors cursor-pointer relative group">
                    <input type="file" accept=".xlsx, .csv" onChange={handleFile} disabled={processing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="pointer-events-none relative z-0">
                        <div className="w-12 h-12 bg-lumina-highlight rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-lumina-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </div>
                        <p className="text-sm font-bold text-lumina-text">Upload Desty Excel Export</p>
                        <p className="text-xs text-lumina-muted mt-1">Supported: .xlsx, .csv</p>
                    </div>
                </div>
            </div>

            {/* Console Log */}
            <div className="bg-[#0B0C10] p-4 rounded-xl border border-lumina-border h-64 overflow-y-auto font-mono text-xs shadow-inner">
                <div className="flex items-center gap-2 mb-3 border-b border-lumina-border pb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-lumina-muted ml-2">Import Terminal</span>
                </div>
                <div className="space-y-1">
                    {logs.map((l,i) => (
                        <div key={i} className={`flex gap-2 ${l.type==='error'?'text-rose-400':(l.type==='success'?'text-emerald-400':'text-lumina-muted')}`}>
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