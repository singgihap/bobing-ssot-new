// lib/cacheManager.js

// --- 1. DEFINISI KEYS (SSOT KUNCI CACHE) ---
export const CACHE_KEYS = {
    // CATALOG
    PRODUCTS: 'lumina_products_data_v3',
    VARIANTS: 'lumina_products_variants_v2',
    CATEGORIES: 'lumina_categories_v2',
    BRANDS: 'lumina_brands_v2',
    COLLECTIONS: 'lumina_collections_v1',
    
    // STOCK & INVENTORY
    INVENTORY: 'lumina_inventory_v3_filters',
    WAREHOUSES: 'lumina_warehouses_v2',
    SNAPSHOTS: 'lumina_pos_snapshots_v2',
    
    // SALES & POS
    POS_MASTER: 'lumina_pos_master_v3_filters',
    CUSTOMERS: 'lumina_customers_v2',
    SALES_HISTORY: 'lumina_sales_history_v2',
    SALES_DASHBOARD: 'lumina_dash_sales_v5_', // Prefix
    
    // PURCHASES
    SUPPLIERS: 'lumina_suppliers_v2',
    PURCHASES_HISTORY: 'lumina_purchases_history_v2',
    PURCHASES_MASTER: 'lumina_purchases_master_v2',
    
    // FINANCE
    ACCOUNTS: 'lumina_finance_accounts_v2',
    TRANSACTIONS: 'lumina_cash_transactions_v2',
    BALANCE_SHEET: 'lumina_balance_v2',
    DASHBOARD_MASTER: 'lumina_dash_master_v5_ssot',
    
    // SETTINGS
    SETTINGS: 'lumina_settings_v2',
};

// --- 2. DURASI DEFAULT (Milliseconds) ---
export const DURATION = {
    SHORT: 5 * 60 * 1000,    // 5 Menit (Dashboard, Transaksi Cepat)
    MEDIUM: 30 * 60 * 1000,  // 30 Menit (POS, Customer)
    LONG: 60 * 60 * 1000,    // 1 Jam (Produk, Inventory)
    VERY_LONG: 24 * 60 * 60 * 1000 // 24 Jam (Settings, Kategori, Brand)
};

// --- 3. HELPER FUNCTIONS ---

/**
 * Mengambil data dari localStorage dengan validasi durasi.
 * @param {string} key - Key cache dari CACHE_KEYS
 * @param {number} maxAge - Durasi kadaluarsa (ms)
 * @returns {any|null} Data atau null jika expired/tidak ada
 */
export const getCache = (key, maxAge = DURATION.MEDIUM) => {
    if (typeof window === 'undefined') return null;
    
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const { data, timestamp } = JSON.parse(item);
        const now = Date.now();

        if (now - timestamp > maxAge) {
            localStorage.removeItem(key); // Auto cleanup
            return null;
        }

        return data;
    } catch (e) {
        console.warn(`Cache parse error for ${key}:`, e);
        return null;
    }
};

/**
 * Menyimpan data ke localStorage dengan timestamp.
 * @param {string} key - Key cache
 * @param {any} data - Data objek/array
 */
export const setCache = (key, data) => {
    if (typeof window === 'undefined') return;
    try {
        const payload = JSON.stringify({
            data,
            timestamp: Date.now()
        });
        localStorage.setItem(key, payload);
    } catch (e) {
        console.warn("Storage full or error:", e);
    }
};

/**
 * Menghapus cache spesifik atau multiple keys.
 * Berguna saat create/update/delete data agar user dapat data terbaru.
 * @param {string|string[]} keys - Single key atau array of keys
 */
export const invalidateCache = (keys) => {
    if (typeof window === 'undefined') return;
    
    const keyList = Array.isArray(keys) ? keys : [keys];
    
    keyList.forEach(key => {
        // Handle prefix logic (misal untuk cache dashboard per range waktu)
        if (key.endsWith('_')) {
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith(key)) localStorage.removeItem(k);
            });
        } else {
            localStorage.removeItem(key);
        }
    });
    
    console.log(`Cache invalidated: ${keyList.join(', ')}`);
};

/**
 * Helper Pintar: Membersihkan cache terkait Modul tertentu.
 * Contoh: Saat ada transaksi POS, kita harus refresh Stok & Finance.
 */
export const invalidateSmart = (moduleName) => {
    switch (moduleName) {
        case 'TRANSACTION':
            invalidateCache([
                CACHE_KEYS.INVENTORY,
                CACHE_KEYS.SNAPSHOTS,
                CACHE_KEYS.SALES_HISTORY,
                CACHE_KEYS.TRANSACTIONS,
                CACHE_KEYS.BALANCE_SHEET,
                CACHE_KEYS.DASHBOARD_MASTER
            ]);
            break;
        case 'PRODUCT':
            invalidateCache([
                CACHE_KEYS.PRODUCTS,
                CACHE_KEYS.VARIANTS,
                CACHE_KEYS.INVENTORY,
                CACHE_KEYS.POS_MASTER
            ]);
            break;
        case 'PURCHASE':
            invalidateCache([
                CACHE_KEYS.PURCHASES_HISTORY,
                CACHE_KEYS.INVENTORY,
                CACHE_KEYS.SNAPSHOTS,
                CACHE_KEYS.TRANSACTIONS,
                CACHE_KEYS.BALANCE_SHEET
            ]);
            break;
        default:
            break;
    }
};