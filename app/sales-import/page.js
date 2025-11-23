// app/sales-import/page.js
"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where, orderBy, runTransaction } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';

export default function ImportSalesPage() {
    const { user } = useAuth();
    const [warehouses, setWarehouses] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [config, setConfig] = useState({ warehouse_id: '', account_id: '', packing_cost: 1000 });
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const init = async () => {
            const whSnap = await getDocs(query(collection(db, "warehouses"), orderBy("created_at")));
            const whData = []; whSnap.forEach(d => { if(d.data().type!=='virtual_supplier') whData.push({id:d.id, ...d.data()}) });
            setWarehouses(whData);

            const accSnap = await getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")));
            const accData = []; accSnap.forEach(d => { 
                const c = d.data().category.toLowerCase();
                if(c.includes('aset') || c.includes('kas') || c.includes('bank')) accData.push({id:d.id, ...d.data()});
            });
            setAccounts(accData);
        };
        init();
    }, []);

    const addLog = (msg, type='info') => setLogs(prev => [...prev, {msg, type}]);

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file || !config.warehouse_id || !config.account_id) return alert("Lengkapi konfigurasi gudang & akun!");

        setProcessing(true);
        setLogs([]);
        addLog("Mulai proses import...", "info");
        addLog("Memuat Master SKU...", "info");

        try {
            // 1. Master SKU
            const varMap = {};
            const vSnap = await getDocs(collection(db, "product_variants"));
            vSnap.forEach(d => { const v=d.data(); if(v.sku) varMap[v.sku.toUpperCase().trim()] = {id:d.id, ...v}; });

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

                const batch = writeBatch(db);
                let count = 0;

                for(const [id, data] of Object.entries(orders)) {
                    const head = data.raw;
                    const ks = Object.keys(head);
                    
                    // Detect Status
                    const kStatus = ks.find(k => k.match(/status/i));
                    const statusRaw = head[kStatus]?.toLowerCase() || 'completed';
                    if(statusRaw.includes('cancel')) { addLog(`SKIP ${id}: Cancelled`, "warning"); continue; }

                    // Detect Amounts
                    const kNet = ks.find(k => k.match(/settlement|penyelesaian|net/i));
                    const kGross = ks.find(k => k.match(/total|gross|subtotal/i));
                    const netAmount = parseFloat(String(head[kNet]||0).replace(/[^\d.-]/g,'')) || 0;
                    const grossAmount = parseFloat(String(head[kGross]||0).replace(/[^\d.-]/g,'')) || 0;

                    // Check Existing
                    const qEx = query(collection(db, "sales_orders"), where("order_number", "==", id));
                    const sEx = await getDocs(qEx);
                    
                    if(!sEx.empty) {
                        // Update Status Only
                        const exDoc = sEx.docs[0];
                        if(exDoc.data().status !== statusRaw) {
                            batch.update(doc(db, "sales_orders", exDoc.id), { status: statusRaw, updated_at: serverTimestamp() });
                            addLog(`UPDATE ${id}: Status -> ${statusRaw}`, "info");
                        }
                    } else {
                        // Create New
                        const poRef = doc(collection(db, "sales_orders"));
                        const kDate = ks.find(k => k.match(/date|tanggal/i));
                        
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
                            created_at: serverTimestamp(),
                            created_by: user?.email
                        });

                        // Items
                        data.items.forEach(item => {
                            const kSku = Object.keys(item).find(k => k.match(/sku/i));
                            const kQty = Object.keys(item).find(k => k.match(/qty|jumlah/i));
                            const sku = String(item[kSku]).toUpperCase().trim();
                            const qty = parseInt(item[kQty]||1);
                            
                            const v = varMap[sku];
                            if(v) {
                                batch.set(doc(collection(db, `sales_orders/${poRef.id}/items`)), {
                                    variant_id: v.id, sku: v.sku, qty: qty, unit_price: 0, unit_cost: v.cost
                                });
                                batch.set(doc(collection(db, "stock_movements")), {
                                    variant_id: v.id, warehouse_id: config.warehouse_id, type: 'sale_out',
                                    qty: -qty, ref_id: poRef.id, ref_type: 'sales_order',
                                    date: serverTimestamp(), notes: `Import ${id}`
                                });
                            }
                        });

                        // Auto Journal Cash if Completed
                        if(statusRaw === 'completed') {
                            const cashRef = doc(collection(db, "cash_transactions"));
                            batch.set(cashRef, {
                                type: 'in', amount: netAmount || grossAmount, date: serverTimestamp(),
                                category: 'penjualan', account_id: config.account_id,
                                description: `Settlement ${id}`, ref_type: 'sales_order', ref_id: poRef.id
                            });
                        }
                        count++;
                        addLog(`NEW ${id}: Created`, "success");
                    }
                }

                await batch.commit();
                addLog(`SELESAI! Proses ${count} order baru.`, "success");
                setProcessing(false);
            };
            reader.readAsArrayBuffer(file);

        } catch(e) { console.error(e); addLog(`ERROR: ${e.message}`, "error"); setProcessing(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in pb-20">
            <div className="card-luxury p-8 bg-lumina-surface border-lumina-border">
                <h2 className="text-xl font-display font-bold text-lumina-text mb-6">Import Sales Report (Marketplace)</h2>
                
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