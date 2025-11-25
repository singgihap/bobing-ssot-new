"use client";
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// Konfigurasi Cache (Reuse dari halaman lain)
const CACHE_KEY_PRODUCTS = 'lumina_products_data_v2';
const CACHE_KEY_BRANDS = 'lumina_brands_v2';
const CACHE_DURATION = 60 * 60 * 1000; // 1 Jam (Cukup lama karena import jarang dilakukan)

export default function ImportProductsPage() {
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);

    const addLog = (msg, type='info') => setLogs(prev => [...prev, {msg, type}]);

    // Fungsi membersihkan cache halaman lain agar data baru muncul
    const invalidateAppCaches = () => {
        if (typeof window === 'undefined') return;
        const keysToRemove = [
            CACHE_KEY_PRODUCTS,       // List Produk berubah
            CACHE_KEY_BRANDS,         // List Brand berubah
            'lumina_inventory_v2',    // Data Inventory berubah (produk baru muncul)
            'lumina_variants_v2',     // Master SKU berubah
            'lumina_pos_master_v2',   // POS perlu reload produk baru
            'lumina_purchases_master_v2' // PO perlu produk baru
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log("App caches invalidated.");
    };

    const getMasterData = async () => {
        let brandsMap = {};
        let prodMap = {};
        let needFetchBrands = true;
        let needFetchProds = true;

        addLog("Memeriksa cache lokal...", "info");

        // 1. Cek Cache LocalStorage (Zero Cost)
        if (typeof window !== 'undefined') {
            // Cek Cache Brands
            const rawBrands = localStorage.getItem(CACHE_KEY_BRANDS);
            if (rawBrands) {
                try {
                    const { data, timestamp } = JSON.parse(rawBrands);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        data.forEach(b => brandsMap[b.name.toLowerCase()] = b.id);
                        needFetchBrands = false;
                        addLog(`Loaded ${data.length} brands from cache.`, "success");
                    }
                } catch(e) {}
            }

            // Cek Cache Products
            const rawProds = localStorage.getItem(CACHE_KEY_PRODUCTS);
            if (rawProds) {
                try {
                    const { products, brands, timestamp } = JSON.parse(rawProds);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        // Jika cache brands masih kosong, ambil dari cache products juga
                        if (needFetchBrands && brands) {
                            brands.forEach(b => brandsMap[b.name.toLowerCase()] = b.id);
                            needFetchBrands = false;
                            addLog(`Loaded ${brands.length} brands from product cache.`, "success");
                        }
                        
                        if (products) {
                            products.forEach(p => {
                                if (p.base_sku) prodMap[p.base_sku.toUpperCase()] = p.id;
                            });
                            needFetchProds = false;
                            addLog(`Loaded ${products.length} products from cache.`, "success");
                        }
                    }
                } catch(e) {}
            }
        }

        // 2. Fetch Firebase (Hanya jika cache tidak ada)
        const promises = [];
        if (needFetchBrands) promises.push(getDocs(collection(db, "brands")));
        if (needFetchProds) promises.push(getDocs(collection(db, "products")));

        if (promises.length > 0) {
            addLog("Mengambil data master terbaru dari server...", "warning");
            const results = await Promise.all(promises);
            let idx = 0;

            if (needFetchBrands) {
                const brandsSnap = results[idx++];
                brandsSnap.forEach(d => brandsMap[d.data().name.toLowerCase()] = d.id);
                addLog(`Fetched ${brandsSnap.size} brands from server.`, "info");
            }

            if (needFetchProds) {
                const prodsSnap = results[idx];
                prodsSnap.forEach(d => {
                    const sku = d.data().base_sku;
                    if(sku) prodMap[sku.toUpperCase()] = d.id;
                });
                addLog(`Fetched ${prodsSnap.size} products from server.`, "info");
            }
        }

        return { brandsMap, prodMap };
    };

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setProcessing(true);
        setLogs([]);

        try {
            // Load Master Data (Cached/Fresh)
            const { brandsMap, prodMap } = await getMasterData();

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const wb = XLSX.read(ev.target.result, {type:'array'});
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                
                addLog(`Mendeteksi ${rows.length} baris data.`, "info");
                
                let success = 0;
                let newBrandsCount = 0;
                let newProdsCount = 0;

                for (const row of rows) {
                    try {
                        const baseSku = String(row['base_sku']||'').toUpperCase().trim();
                        const prodName = row['product_name'];
                        if(!baseSku || !prodName) continue;

                        // 1. Handle Brand
                        let brandId = null;
                        if(row['brand']) {
                            const bName = row['brand'].trim();
                            const bKey = bName.toLowerCase();
                            if(brandsMap[bKey]) {
                                brandId = brandsMap[bKey];
                            } else {
                                const bRef = await addDoc(collection(db, "brands"), { name: bName, type: 'supplier_brand', created_at: serverTimestamp() });
                                brandId = bRef.id; 
                                brandsMap[bKey] = brandId; // Update local map
                                newBrandsCount++;
                                addLog(`Brand Baru: ${bName}`, "success");
                            }
                        }

                        // 2. Handle Product (Parent)
                        let prodId = prodMap[baseSku];
                        if(!prodId) {
                            const pRef = await addDoc(collection(db, "products"), {
                                base_sku: baseSku, name: prodName, brand_id: brandId, 
                                category: row['category']||'Uncategorized', status: 'active', created_at: serverTimestamp()
                            });
                            prodId = pRef.id; 
                            prodMap[baseSku] = prodId; // Update local map
                            newProdsCount++;
                            addLog(`Produk Baru: ${prodName}`, "success");
                        }

                        // 3. Handle Variant
                        const color = String(row['color']||'STD').toUpperCase().replace(/\s+/g, '-');
                        const size = String(row['size']||'ALL').toUpperCase().replace(/\s+/g, '-');
                        const sku = `${baseSku}-${color}-${size}`;
                        
                        // Cek Variant Existing (Real-time check wajib untuk variant spesifik demi integritas)
                        const qVar = query(collection(db, "product_variants"), where("sku", "==", sku));
                        const sVar = await getDocs(qVar);
                        
                        if(sVar.empty) {
                            await addDoc(collection(db, "product_variants"), {
                                product_id: prodId, sku, color, size, 
                                cost: parseInt(row['cost']||0), price: parseInt(row['price']||0),
                                weight: parseInt(row['weight']||0), status: 'active', created_at: serverTimestamp()
                            });
                            addLog(`+ Varian: ${sku}`, "success");
                            success++;
                        }
                    } catch(err) { 
                        console.error(err); 
                        addLog(`Error baris: ${err.message}`, "error"); 
                    }
                }
                
                addLog(`Selesai. ${success} varian ditambahkan.`, "info");
                
                // Jika ada data baru, hapus cache aplikasi agar data muncul di halaman lain
                if (success > 0 || newBrandsCount > 0 || newProdsCount > 0) {
                    invalidateAppCaches();
                    addLog("Cache aplikasi dibersihkan agar data baru muncul.", "warning");
                }
                
                setProcessing(false);
            };
            reader.readAsArrayBuffer(file);

        } catch(e) { 
            addLog(e.message, "error"); 
            setProcessing(false); 
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in">
            <div className="card-luxury p-6 bg-lumina-surface border-lumina-border">
                <h2 className="text-xl md:text-3xl font-bold text-lumina-text mb-4 font-display">
                    Import Products & Variants
                </h2>
                <div className="border-2 border-dashed border-lumina-border rounded-xl p-8 text-center bg-lumina-surface/50 hover:bg-lumina-surface transition-colors cursor-pointer relative group">
                    <input type="file" accept=".csv, .xlsx" onChange={handleFile} disabled={processing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="pointer-events-none relative z-0">
                        <div className="w-12 h-12 bg-lumina-highlight rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-lumina-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </div>
                        <p className="text-sm font-bold text-lumina-text">Click to upload file</p>
                        <p className="text-xs text-lumina-muted mt-1">Supported: .xlsx, .csv</p>
                        <p className="text-[10px] text-lumina-muted/60 mt-2 font-mono">Format: base_sku, product_name, brand, category, color, size, cost, price</p>
                    </div>
                </div>
            </div>
            
            {/* Console Log Terminal */}
            <div className="bg-[#0B0C10] p-4 rounded-xl border border-lumina-border h-64 overflow-y-auto font-mono text-xs shadow-inner">
                <div className="flex items-center gap-2 mb-3 border-b border-lumina-border pb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-lumina-muted ml-2">Import Terminal</span>
                </div>
                <div className="space-y-1">
                    {logs.length === 0 ? (
                        <span className="text-lumina-muted/50 animate-pulse">Waiting for file...</span>
                    ) : logs.map((l, i) => (
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