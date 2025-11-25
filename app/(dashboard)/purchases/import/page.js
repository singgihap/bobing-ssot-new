"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, orderBy, increment } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';

// Konfigurasi Cache Keys (Reuse dari halaman lain)
const CACHE_KEY_VARIANTS = 'lumina_variants_v2';
const CACHE_KEY_INVENTORY = 'lumina_inventory_v2';
const CACHE_KEY_PURCHASES_MASTER = 'lumina_purchases_master_v2';
const CACHE_DURATION = 60 * 60 * 1000; // 1 Jam (Reuse data master)

export default function ImportPurchasesPage() {
    const { user } = useAuth();
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWh, setSelectedWh] = useState('');
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const fetchWh = async () => {
            if (typeof window === 'undefined') return;

            // 1. Coba Reuse Cache Warehouse dari Inventory/Purchases Page
            let whData = null;
            const cacheInv = localStorage.getItem(CACHE_KEY_INVENTORY);
            const cachePurch = localStorage.getItem(CACHE_KEY_PURCHASES_MASTER);

            if (cacheInv) {
                try {
                    const parsed = JSON.parse(cacheInv);
                    if (parsed.warehouses && parsed.warehouses.length > 0) whData = parsed.warehouses;
                } catch (e) {}
            }

            if (!whData && cachePurch) {
                try {
                    const parsed = JSON.parse(cachePurch);
                    if (parsed.warehouses && parsed.warehouses.length > 0) whData = parsed.warehouses;
                } catch (e) {}
            }

            // Filter hanya gudang fisik
            if (whData) {
                const physicalWh = whData.filter(d => d.type === 'physical' || !d.type);
                if (physicalWh.length > 0) {
                    setWarehouses(physicalWh);
                    return; // Stop, hemat reads
                }
            }

            // 2. Fallback Fetch jika cache kosong
            const q = query(collection(db, "warehouses"), orderBy("created_at"));
            const snap = await getDocs(q);
            const data = [];
            snap.forEach(d => { if(d.data().type === 'physical' || !d.data().type) data.push({id:d.id, ...d.data()}) });
            setWarehouses(data);
        };
        fetchWh();
    }, []);

    const addLog = (msg, type='info') => setLogs(prev => [...prev, {msg, type}]);

    // Fungsi Invalidate Cache agar data di halaman lain update
    const invalidateCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('lumina_inventory_v2');       // Stok berubah
        localStorage.removeItem('lumina_balance_v2');         // Nilai Aset/Hutang berubah
        localStorage.removeItem('lumina_purchases_history_v2'); // History PO berubah
        localStorage.removeItem('lumina_dash_master_v2');     // Dashboard Stock/Cash berubah
        localStorage.removeItem('lumina_pos_snapshots_v2');   // POS Stock berubah
        console.log("Cache invalidation complete.");
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
                    // Gunakan cache jika ada, meskipun agak lama (karena ini untuk mapping SKU static)
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

        // 2. Fetch Firebase (Hanya jika cache tidak ada)
        if (!loadedFromCache) {
            addLog("Mengambil data master varian terbaru dari server...", "warning");
            const varSnap = await getDocs(collection(db, "product_variants"));
            varSnap.forEach(d => {
                const v = d.data();
                if(v.sku) varMap[v.sku.toUpperCase().trim()] = { id: d.id, ...v };
            });
            
            // Simpan Cache untuk penggunaan di masa depan
            if (typeof window !== 'undefined') {
                const variantsArray = Object.values(varMap);
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
        if (!file || !selectedWh) return alert("Pilih gudang dan file!");
        
        setProcessing(true);
        setLogs([]);
        
        try {
            // 1. Load Master Variants (Cached)
            const varMap = await getMasterVariants();

            // 2. Read File
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const workbook = XLSX.read(ev.target.result, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);

                if (rows.length === 0) { setProcessing(false); return alert("File kosong"); }

                // 3. Group by Invoice/PO Ref
                const groups = {};
                rows.forEach(row => {
                    // Auto detect keys (case insensitive)
                    const keys = Object.keys(row);
                    const kInv = keys.find(k => k.match(/invoice|stock in id|ref/i));
                    const kSku = keys.find(k => k.match(/sku|varian id/i));
                    const kQty = keys.find(k => k.match(/qty|jumlah/i));
                    const kCost = keys.find(k => k.match(/cost|harga/i));

                    if (kInv && kSku && row[kInv]) {
                        const inv = row[kInv];
                        if (!groups[inv]) groups[inv] = [];
                        groups[inv].push({
                            sku: String(row[kSku]).toUpperCase().trim(),
                            qty: parseInt(row[kQty] || 0),
                            cost: parseInt(row[kCost] || 0)
                        });
                    }
                });

                // 4. Process Groups (With Batch Chunking)
                // Firebase Batch Limit = 500 operations. Kita commit setiap 450.
                let batch = writeBatch(db);
                let opCount = 0; // Counter operasi dalam batch saat ini
                let poCount = 0;

                for (const [inv, items] of Object.entries(groups)) {
                    const validItems = [];
                    let totalAmount = 0;
                    let totalQty = 0;

                    items.forEach(item => {
                        const v = varMap[item.sku];
                        if (v) {
                            validItems.push({ ...item, variant_id: v.id });
                            totalAmount += (item.qty * item.cost);
                            totalQty += item.qty;
                        } else {
                            addLog(`[SKIP] SKU tidak ditemukan: ${item.sku}`, "error");
                        }
                    });

                    if (validItems.length > 0) {
                        // A. Create PO Header (1 Op)
                        const poRef = doc(collection(db, "purchase_orders"));
                        batch.set(poRef, {
                            supplier_name: 'Imported',
                            warehouse_id: selectedWh,
                            order_date: serverTimestamp(),
                            status: 'received_full',
                            total_amount: totalAmount,
                            total_qty: totalQty,
                            payment_status: 'unpaid',
                            notes: `Import Ref: ${inv}`,
                            created_at: serverTimestamp(),
                            created_by: user?.email
                        });
                        opCount++;

                        for (const item of validItems) {
                            // B. Create PO Item (1 Op)
                            const itemRef = doc(collection(db, `purchase_orders/${poRef.id}/items`));
                            batch.set(itemRef, { variant_id: item.variant_id, qty: item.qty, unit_cost: item.cost, subtotal: item.qty*item.cost });
                            opCount++;

                            // C. Create Movement (1 Op)
                            const moveRef = doc(collection(db, "stock_movements"));
                            batch.set(moveRef, {
                                variant_id: item.variant_id, warehouse_id: selectedWh, type: 'purchase_in',
                                qty: item.qty, unit_cost: item.cost, ref_id: poRef.id, ref_type: 'purchase_order',
                                date: serverTimestamp(), notes: `Import ${inv}`
                            });
                            opCount++;

                            // D. Update/Set Stock Snapshot (1 Op)
                            // Menggunakan increment agar atomic dan tidak perlu read dulu (0 Read Cost)
                            const snapRef = doc(db, "stock_snapshots", `${item.variant_id}_${selectedWh}`);
                            batch.set(snapRef, { 
                                id: `${item.variant_id}_${selectedWh}`,
                                variant_id: item.variant_id, 
                                warehouse_id: selectedWh, 
                                qty: increment(item.qty) // Menambah stok otomatis
                            }, { merge: true });
                            opCount++;

                            // Safety Check: Commit jika mendekati limit 500
                            if (opCount >= 450) {
                                await batch.commit();
                                batch = writeBatch(db); // Reset batch
                                opCount = 0;
                                addLog(`...menyimpan batch sebagian...`, "warning");
                            }
                        }
                        
                        poCount++;
                        addLog(`[OK] PO ${inv}: ${validItems.length} items`, "success");
                    }
                }

                // Commit sisa operasi
                if (opCount > 0) await batch.commit();
                
                invalidateCaches();
                addLog(`SELESAI! Berhasil import ${poCount} PO.`, "success");
                setProcessing(false);
            };
            reader.readAsArrayBuffer(file);

        } catch (e) { 
            console.error(e); 
            addLog(`ERROR: ${e.message}`, "error"); 
            setProcessing(false); 
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in pb-20">
            <div className="card-luxury p-8 bg-surface border-lumina-border">
                <h2 className="text-xl md:text-3xl font-display font-bold text-text-primary mb-6">
                    Import Purchase Orders (Stock In)
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Step 1: Warehouse */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-lumina-gold uppercase tracking-wider mb-1">1. Target Warehouse</label>
                        <select className="input-luxury bg-surface" value={selectedWh} onChange={e => setSelectedWh(e.target.value)}>
                            <option value="">-- Select Warehouse --</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <p className="text-xs text-text-secondary mt-2">Select where the stock will be added.</p>
                    </div>

                    {/* Step 2: Upload */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-lumina-gold uppercase tracking-wider mb-1">2. Upload File</label>
                        <div className="border-2 border-dashed border-lumina-border rounded-xl p-6 text-center bg-surface/50 hover:bg-surface hover:border-lumina-gold/50 transition-all cursor-pointer relative group h-32 flex flex-col items-center justify-center">
                            <input type="file" accept=".csv, .xlsx" onChange={handleFile} disabled={processing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <svg className="w-8 h-8 text-text-secondary group-hover:text-lumina-gold transition-colors mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                            <p className="text-xs font-medium text-text-primary">Click to upload .xlsx / .csv</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Console Log Terminal */}
            <div className="bg-[#0B0C10] p-4 rounded-xl border border-lumina-border h-64 overflow-y-auto font-mono text-xs shadow-inner">
                <div className="flex items-center gap-2 mb-3 border-b border-lumina-border pb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-text-secondary ml-2">System Log</span>
                </div>
                <div className="space-y-1">
                    {logs.length === 0 ? (
                        <span className="text-text-secondary/50 animate-pulse">Waiting for input...</span>
                    ) : logs.map((l, i) => (
                        <div key={i} className={`flex gap-2 ${l.type==='error'?'text-rose-400':(l.type==='success'?'text-emerald-400':'text-text-secondary')}`}>
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