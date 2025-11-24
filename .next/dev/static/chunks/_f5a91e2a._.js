(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/utils.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// lib/utils.js
__turbopack_context__.s([
    "formatRupiah",
    ()=>formatRupiah,
    "sizeRank",
    ()=>sizeRank,
    "sortBySize",
    ()=>sortBySize
]);
const formatRupiah = (n)=>{
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(n);
};
const sizeRank = [
    'ALL',
    'ALL SIZE',
    'ALLSIZE',
    'XXXS',
    'XXS',
    'XS',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    '2XL',
    '3XL',
    'XXXL',
    '4XL',
    '5XL'
];
const sortBySize = (variantA, variantB)=>{
    const sizeA = (variantA.size || '').toUpperCase().trim();
    const sizeB = (variantB.size || '').toUpperCase().trim();
    const idxA = sizeRank.indexOf(sizeA);
    const idxB = sizeRank.indexOf(sizeB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    const colorCompare = (variantA.color || '').localeCompare(variantB.color || '');
    if (colorCompare !== 0) return colorCompare;
    return (variantA.sku || '').localeCompare(variantB.sku || '');
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/cash/page.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// app/cash/page.js
__turbopack_context__.s([
    "default",
    ()=>CashFlowPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/firebase.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$esm$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/esm/index.esm.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.esm2017.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$usePortal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/usePortal.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-hot-toast/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_KEY_DATA = 'lumina_cash_data_v2'; // Accounts & Transactions
const CACHE_KEY_CATS = 'lumina_cash_categories_v2';
const CACHE_DURATION = 5 * 60 * 1000; // 5 Menit
// Cache Key External untuk di-reuse
const CACHE_KEY_POS = 'lumina_pos_master_v2';
function CashFlowPage() {
    _s();
    const [accounts, setAccounts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [transactions, setTransactions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [summary, setSummary] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        in: 0,
        out: 0
    });
    const [expandedDates, setExpandedDates] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [modalExpOpen, setModalExpOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [modalTfOpen, setModalTfOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        type: 'out',
        account_id: '',
        category: '',
        amount: '',
        description: '',
        date: ''
    });
    const [tfData, setTfData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        from: '',
        to: '',
        amount: '',
        note: ''
    });
    const [categories, setCategories] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    // Edit States
    const [modalEditOpen, setModalEditOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [editingTransaction, setEditingTransaction] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [editFormData, setEditFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        date: '',
        account_id: '',
        category: '',
        amount: '',
        description: ''
    });
    // Helper: Invalidate Cache Relevan
    const invalidateRelatedCaches = ()=>{
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        localStorage.removeItem(CACHE_KEY_DATA); // Refresh halaman ini
        localStorage.removeItem('lumina_dash_master_v2'); // Refresh Dashboard (Saldo berubah)
        localStorage.removeItem('lumina_pos_master_v2'); // Refresh POS (Saldo akun berubah)
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CashFlowPage.useEffect": ()=>{
            fetchData();
            fetchCategories();
        }
    }["CashFlowPage.useEffect"], []);
    // 1. Fetch Categories (Optimized)
    const fetchCategories = async ()=>{
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        const cached = localStorage.getItem(CACHE_KEY_CATS);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < 30 * 60 * 1000) {
                setCategories(data);
                return;
            }
        }
        try {
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "chart_of_accounts"), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderBy"])("code"));
            const snap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])(q);
            const cats = [];
            snap.forEach((d)=>{
                const c = d.data();
                if (c.category && (c.category.includes('Beban') || c.category.includes('Pendapatan'))) {
                    cats.push({
                        id: d.id,
                        name: c.name,
                        category: c.category
                    });
                }
            });
            setCategories(cats);
            localStorage.setItem(CACHE_KEY_CATS, JSON.stringify({
                data: cats,
                ts: Date.now()
            }));
        } catch (e) {
            console.error(e);
        }
    };
    // 2. Fetch Data Utama (Accounts & Transactions)
    const fetchData = async (forceRefresh = false)=>{
        setLoading(true);
        try {
            let accList = [];
            let transList = [];
            let loadedFromCache = false;
            // A. Cek Cache LocalStorage
            if (!forceRefresh && ("TURBOPACK compile-time value", "object") !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY_DATA);
                if (cached) {
                    const { accounts: cAcc, transactions: cTx, ts } = JSON.parse(cached);
                    if (Date.now() - ts < CACHE_DURATION) {
                        accList = cAcc;
                        transList = cTx;
                        loadedFromCache = true;
                    }
                }
            }
            // B. Reuse Cache POS untuk Accounts (Jika cache halaman ini expired/kosong)
            if (!loadedFromCache && accList.length === 0 && ("TURBOPACK compile-time value", "object") !== 'undefined') {
                const cachedPos = localStorage.getItem(CACHE_KEY_POS);
                if (cachedPos) {
                    try {
                        const parsed = JSON.parse(cachedPos);
                        if (parsed.data?.acc && Date.now() - parsed.ts < 60 * 60 * 1000) {
                            accList = parsed.data.acc; // Hemat Reads!
                        }
                    } catch (e) {}
                }
            }
            // C. Fetch Firebase jika belum lengkap
            const promises = [];
            if (accList.length === 0) promises.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts"), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderBy"])("created_at"))));
            if (!loadedFromCache) promises.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDocs"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["query"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_transactions"), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["orderBy"])("date", "desc"), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["limit"])(50))));
            if (promises.length > 0) {
                const results = await Promise.all(promises);
                let idx = 0;
                if (accList.length === 0) {
                    const accSnap = results[idx++];
                    accList = [];
                    accSnap.forEach((d)=>accList.push({
                            id: d.id,
                            ...d.data()
                        }));
                }
                if (!loadedFromCache) {
                    const transSnap = results[idx];
                    transList = [];
                    transSnap.forEach((d)=>{
                        const t = d.data();
                        transList.push({
                            id: d.id,
                            ...t,
                            date: t.date?.toDate ? t.date.toDate().toISOString() : t.date
                        });
                    });
                }
                // Simpan Cache Baru
                if ("TURBOPACK compile-time truthy", 1) {
                    localStorage.setItem(CACHE_KEY_DATA, JSON.stringify({
                        accounts: accList,
                        transactions: transList,
                        ts: Date.now()
                    }));
                }
            }
            setAccounts(accList);
            setTransactions(transList);
            // Hitung Summary Client-Side
            let totalIn = 0, totalOut = 0;
            transList.forEach((t)=>{
                if (t.type === 'in') totalIn += t.amount || 0;
                else totalOut += t.amount || 0;
            });
            setSummary({
                in: totalIn,
                out: totalOut
            });
        } catch (e) {
            console.error(e);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Gagal memuat data kas");
        } finally{
            setLoading(false);
        }
    };
    const submitTransaction = async (e)=>{
        e.preventDefault();
        const toastId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].loading("Menyimpan...");
        try {
            const amt = parseInt(formData.amount);
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runTransaction"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], async (t)=>{
                const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_transactions"));
                t.set(ref, {
                    ...formData,
                    amount: amt,
                    date: new Date(formData.date),
                    created_at: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
                    ref_type: 'manual_entry'
                });
                const accRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts", formData.account_id);
                const accDoc = await t.get(accRef);
                const newBal = formData.type === 'in' ? (accDoc.data().balance || 0) + amt : (accDoc.data().balance || 0) - amt;
                t.update(accRef, {
                    balance: newBal
                });
            });
            setModalExpOpen(false);
            setFormData({
                type: 'out',
                account_id: '',
                category: '',
                amount: '',
                description: '',
                date: ''
            });
            invalidateRelatedCaches();
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Transaksi disimpan!", {
                id: toastId
            });
            fetchData(true);
        } catch (e) {
            console.error(e);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error(`Gagal: ${e.message}`, {
                id: toastId
            });
        }
    };
    const submitTransfer = async (e)=>{
        e.preventDefault();
        if (tfData.from === tfData.to) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error("Akun asal dan tujuan tidak boleh sama!");
        const toastId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].loading("Transferring...");
        try {
            const amt = parseInt(tfData.amount);
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runTransaction"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], async (t)=>{
                const fromRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts", tfData.from);
                const toRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts", tfData.to);
                const fromDoc = await t.get(fromRef);
                const toDoc = await t.get(toRef);
                t.update(fromRef, {
                    balance: (fromDoc.data().balance || 0) - amt
                });
                t.update(toRef, {
                    balance: (toDoc.data().balance || 0) + amt
                });
                const logRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_transactions"));
                t.set(logRef, {
                    type: 'transfer',
                    amount: amt,
                    date: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
                    description: `To ${toDoc.data().name}: ${tfData.note}`,
                    account_id: tfData.from,
                    ref_type: 'transfer_out'
                });
                const logRefIn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_transactions"));
                t.set(logRefIn, {
                    type: 'transfer',
                    amount: amt,
                    date: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
                    description: `From ${fromDoc.data().name}: ${tfData.note}`,
                    account_id: tfData.to,
                    ref_type: 'transfer_in'
                });
            });
            setModalTfOpen(false);
            setTfData({
                from: '',
                to: '',
                amount: '',
                note: ''
            });
            invalidateRelatedCaches();
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Transfer Berhasil!", {
                id: toastId
            });
            fetchData(true);
        } catch (e) {
            console.error(e);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error(`Gagal: ${e.message}`, {
                id: toastId
            });
        }
    };
    // --- HELPER DATA PROCESSING ---
    const getDateObj = (dateItem)=>{
        // Handle Firestore Timestamp OR ISO String (from Cache)
        if (!dateItem) return new Date();
        return dateItem.toDate ? dateItem.toDate() : new Date(dateItem);
    };
    const separateTransactions = (transactions)=>{
        const settlementTransactions = [];
        const normalTransactions = [];
        transactions.forEach((transaction)=>{
            if (transaction.description && transaction.description.toLowerCase().includes('settlement')) {
                settlementTransactions.push(transaction);
            } else {
                normalTransactions.push(transaction);
            }
        });
        return {
            settlementTransactions,
            normalTransactions
        };
    };
    const groupTransactionsByDate = (transactions)=>{
        const grouped = {};
        transactions.forEach((transaction)=>{
            const date = getDateObj(transaction.date).toLocaleDateString();
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(transaction);
        });
        return Object.entries(grouped).sort((a, b)=>new Date(b[0]) - new Date(a[0])).map(([date, items])=>({
                date,
                items
            }));
    };
    const toggleDateExpand = (date)=>setExpandedDates((prev)=>({
                ...prev,
                [date]: !prev[date]
            }));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CashFlowPage.useEffect": ()=>{
            if (transactions.length > 0) {
                const { settlementTransactions } = separateTransactions(transactions);
                if (settlementTransactions.length > 0 && Object.keys(expandedDates).length === 0) {
                    const firstDate = groupTransactionsByDate(settlementTransactions)[0]?.date;
                    if (firstDate) setExpandedDates({
                        [firstDate]: true
                    });
                }
            }
        }
    }["CashFlowPage.useEffect"], [
        transactions
    ]);
    const handleOpenEditModal = (transaction)=>{
        setEditingTransaction(transaction);
        setEditFormData({
            date: getDateObj(transaction.date).toISOString().split('T')[0],
            account_id: transaction.account_id,
            category: transaction.category || '',
            amount: transaction.amount.toString(),
            description: transaction.description
        });
        setModalEditOpen(true);
    };
    const submitEditTransaction = async (e)=>{
        e.preventDefault();
        const toastId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].loading("Updating...");
        try {
            const newAmount = parseInt(editFormData.amount);
            const oldAmount = editingTransaction.amount;
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runTransaction"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], async (t)=>{
                const transRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_transactions", editingTransaction.id);
                const accRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts", editFormData.account_id);
                const accDoc = await t.get(accRef);
                let oldAccDoc = null;
                if (editFormData.account_id !== editingTransaction.account_id) {
                    const oldAccRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts", editingTransaction.account_id);
                    oldAccDoc = await t.get(oldAccRef);
                }
                t.update(transRef, {
                    date: new Date(editFormData.date),
                    account_id: editFormData.account_id,
                    category: editFormData.category,
                    amount: newAmount,
                    description: editFormData.description
                });
                let currentBalance = accDoc.data().balance || 0;
                const isInc = editingTransaction.type === 'in' || editingTransaction.ref_type === 'transfer_in';
                let newBalance = isInc ? currentBalance - oldAmount : currentBalance + oldAmount; // Undo Old
                newBalance = isInc ? newBalance + newAmount : newBalance - newAmount; // Apply New
                t.update(accRef, {
                    balance: newBalance
                });
                if (editFormData.account_id !== editingTransaction.account_id) {
                    const oldAccRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts", editingTransaction.account_id);
                    let oldAccBalance = oldAccDoc.data().balance || 0;
                    oldAccBalance = isInc ? oldAccBalance - oldAmount : oldAccBalance + oldAmount;
                    t.update(oldAccRef, {
                        balance: oldAccBalance
                    });
                }
            });
            setModalEditOpen(false);
            setEditingTransaction(null);
            setEditFormData({
                date: '',
                account_id: '',
                category: '',
                amount: '',
                description: ''
            });
            invalidateRelatedCaches();
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Update Berhasil!", {
                id: toastId
            });
            fetchData(true);
        } catch (e) {
            console.error(e);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error(`Gagal: ${e.message}`, {
                id: toastId
            });
        }
    };
    const handleDeleteTransaction = async ()=>{
        if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
        const toastId = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].loading("Menghapus...");
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["runTransaction"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], async (t)=>{
                const transRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_transactions", editingTransaction.id);
                const accRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$esm2017$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$firebase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"], "cash_accounts", editingTransaction.account_id);
                const accDoc = await t.get(accRef);
                t.delete(transRef);
                const isInc = editingTransaction.type === 'in' || editingTransaction.ref_type === 'transfer_in';
                const currentBalance = accDoc.data().balance || 0;
                const newBalance = isInc ? currentBalance - editingTransaction.amount : currentBalance + editingTransaction.amount;
                t.update(accRef, {
                    balance: newBalance
                });
            });
            setModalEditOpen(false);
            setEditingTransaction(null);
            invalidateRelatedCaches();
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].success("Dihapus!", {
                id: toastId
            });
            fetchData(true);
        } catch (e) {
            console.error(e);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$hot$2d$toast$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].error(`Gagal: ${e.message}`, {
                id: toastId
            });
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "max-w-7xl mx-auto space-y-8 fade-in pb-20",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-xl md:text-3xl font-display font-bold text-lumina-text",
                                children: "Cash Flow"
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 384,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-lumina-muted mt-1 font-light",
                                children: "Manage wallets & transactions."
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 387,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 383,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setModalTfOpen(true),
                                className: "btn-ghost-dark text-xs",
                                children: "Transfer"
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 392,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>{
                                    setFormData({
                                        type: 'out',
                                        date: new Date().toISOString().split('T')[0],
                                        account_id: '',
                                        category: '',
                                        amount: '',
                                        description: ''
                                    });
                                    setModalExpOpen(true);
                                },
                                className: "btn-gold",
                                children: "Record Transaction"
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 398,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 391,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/cash/page.js",
                lineNumber: 382,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
                children: accounts.map((acc)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "card-luxury p-6 flex flex-col justify-between relative overflow-hidden group hover:border-lumina-gold/50 transition-all",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative z-10",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[10px] font-bold text-lumina-muted uppercase tracking-wider mb-1",
                                        children: acc.name
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 421,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-2xl font-display font-bold text-white tracking-tight",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRupiah"])(acc.balance)
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 422,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 420,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-4 flex items-center gap-2 text-xs text-lumina-muted relative z-10",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "bg-lumina-highlight px-2 py-0.5 rounded font-mono text-lumina-gold",
                                    children: acc.code
                                }, void 0, false, {
                                    fileName: "[project]/app/cash/page.js",
                                    lineNumber: 425,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 424,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                    className: "w-16 h-16 text-lumina-gold",
                                    fill: "currentColor",
                                    viewBox: "0 0 20 20",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            d: "M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"
                                        }, void 0, false, {
                                            fileName: "[project]/app/cash/page.js",
                                            lineNumber: 428,
                                            columnNumber: 113
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            fillRule: "evenodd",
                                            d: "M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z",
                                            clipRule: "evenodd"
                                        }, void 0, false, {
                                            fileName: "[project]/app/cash/page.js",
                                            lineNumber: 428,
                                            columnNumber: 165
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/cash/page.js",
                                    lineNumber: 428,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 427,
                                columnNumber: 25
                            }, this)
                        ]
                    }, acc.id, true, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 419,
                        columnNumber: 21
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/cash/page.js",
                lineNumber: 417,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "card-luxury overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-6 py-4 border-b border-lumina-border bg-lumina-surface/50 flex justify-between items-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "font-bold text-lumina-text text-sm uppercase tracking-wider",
                                children: "Recent Transactions"
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 436,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] font-medium text-lumina-muted bg-lumina-highlight px-2 py-1 rounded",
                                children: "Last 50 entries"
                            }, void 0, false, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 437,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 435,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "table-wrapper-dark border-none shadow-none rounded-none",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                            className: "table-dark",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "pl-6 w-8"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 443,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "pl-2",
                                                children: "Date"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 444,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: "Wallet"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 445,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: "Category"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 446,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: "Description"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 447,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "text-right pr-6",
                                                children: "Amount (Editable)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 448,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 442,
                                        columnNumber: 29
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/cash/page.js",
                                    lineNumber: 441,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                    children: (()=>{
                                        const { settlementTransactions, normalTransactions } = separateTransactions(transactions);
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                normalTransactions.map((t)=>{
                                                    const isInc = t.type === 'in' || t.ref_type === 'transfer_in';
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                        onClick: ()=>handleOpenEditModal(t),
                                                        className: "hover:bg-lumina-highlight/20 transition-colors border-b border-lumina-border/30 cursor-pointer group",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {}, void 0, false, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 460,
                                                                columnNumber: 49
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "pl-2 font-mono text-xs text-lumina-muted",
                                                                children: getDateObj(t.date).toLocaleDateString()
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 461,
                                                                columnNumber: 49
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "font-medium text-lumina-text text-xs",
                                                                children: accounts.find((a)=>a.id === t.account_id)?.name || 'Unknown'
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 462,
                                                                columnNumber: 49
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "badge-luxury badge-neutral",
                                                                    children: t.category || 'General'
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/cash/page.js",
                                                                    lineNumber: 463,
                                                                    columnNumber: 53
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 463,
                                                                columnNumber: 49
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "text-lumina-muted truncate max-w-xs text-sm",
                                                                children: t.description
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 464,
                                                                columnNumber: 49
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: `text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'} group-hover:text-lumina-gold transition-colors`,
                                                                children: [
                                                                    isInc ? '+' : '-',
                                                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRupiah"])(t.amount)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 465,
                                                                columnNumber: 49
                                                            }, this)
                                                        ]
                                                    }, t.id, true, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 459,
                                                        columnNumber: 45
                                                    }, this);
                                                }),
                                                groupTransactionsByDate(settlementTransactions).map((group)=>{
                                                    const groupTotal = group.items.reduce((sum, item)=>sum + (item.amount || 0), 0);
                                                    const isInc = groupTotal >= 0;
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Fragment, {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                onClick: ()=>toggleDateExpand(group.date),
                                                                className: "bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer border-t-2 border-lumina-gold/40 transition-colors group/header",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        className: "pl-6 text-center",
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: `inline-block transition-transform duration-300 text-lumina-gold ${expandedDates[group.date] ? 'rotate-180' : ''}`,
                                                                            children: "▼"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 477,
                                                                            columnNumber: 86
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/cash/page.js",
                                                                        lineNumber: 477,
                                                                        columnNumber: 53
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        className: "pl-2 py-3",
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "font-semibold text-lumina-gold text-sm",
                                                                            children: group.date
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 478,
                                                                            columnNumber: 79
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/cash/page.js",
                                                                        lineNumber: 478,
                                                                        columnNumber: 53
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        colSpan: "2",
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-xs text-white bg-orange-600/40 px-3 py-1 rounded border border-orange-500/50",
                                                                            children: [
                                                                                "Total Settlement • ",
                                                                                group.items.length,
                                                                                " invoice"
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 479,
                                                                            columnNumber: 69
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/app/cash/page.js",
                                                                        lineNumber: 479,
                                                                        columnNumber: 53
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        className: "text-lumina-muted text-sm",
                                                                        children: [
                                                                            "Settlement sales date ",
                                                                            group.date
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/cash/page.js",
                                                                        lineNumber: 480,
                                                                        columnNumber: 53
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        className: `text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'}`,
                                                                        children: [
                                                                            isInc ? '+' : '',
                                                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRupiah"])(groupTotal)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/app/cash/page.js",
                                                                        lineNumber: 481,
                                                                        columnNumber: 53
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 476,
                                                                columnNumber: 49
                                                            }, this),
                                                            expandedDates[group.date] && group.items.map((t)=>{
                                                                const isInc = t.type === 'in' || t.ref_type === 'transfer_in';
                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                    onClick: ()=>handleOpenEditModal(t),
                                                                    className: "hover:bg-orange-900/20 transition-colors border-b border-lumina-border/30 bg-gray-900/50 cursor-pointer group",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {}, void 0, false, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 487,
                                                                            columnNumber: 61
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                            className: "pl-2 font-mono text-xs text-lumina-muted",
                                                                            children: getDateObj(t.date).toLocaleDateString()
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 488,
                                                                            columnNumber: 61
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                            className: "font-medium text-lumina-text text-xs",
                                                                            children: accounts.find((a)=>a.id === t.account_id)?.name || 'Unknown'
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 489,
                                                                            columnNumber: 61
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "badge-luxury badge-neutral text-orange-300 bg-orange-900/30 border-orange-600/50",
                                                                                children: t.category || 'General'
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/app/cash/page.js",
                                                                                lineNumber: 490,
                                                                                columnNumber: 65
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 490,
                                                                            columnNumber: 61
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                            className: "text-lumina-muted truncate max-w-xs text-sm italic",
                                                                            children: t.description
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 491,
                                                                            columnNumber: 61
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                            className: `text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'} group-hover:text-lumina-gold transition-colors`,
                                                                            children: [
                                                                                isInc ? '+' : '-',
                                                                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRupiah"])(t.amount)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/app/cash/page.js",
                                                                            lineNumber: 492,
                                                                            columnNumber: 61
                                                                        }, this)
                                                                    ]
                                                                }, t.id, true, {
                                                                    fileName: "[project]/app/cash/page.js",
                                                                    lineNumber: 486,
                                                                    columnNumber: 57
                                                                }, this);
                                                            })
                                                        ]
                                                    }, group.date, true, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 475,
                                                        columnNumber: 45
                                                    }, this);
                                                })
                                            ]
                                        }, void 0, true);
                                    })()
                                }, void 0, false, {
                                    fileName: "[project]/app/cash/page.js",
                                    lineNumber: 451,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/cash/page.js",
                            lineNumber: 440,
                            columnNumber: 21
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 439,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/cash/page.js",
                lineNumber: 434,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$usePortal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
                children: modalEditOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center mb-6 pb-4 border-b border-lumina-border",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-lg font-bold text-white",
                                        children: "Edit Transaction"
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 513,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>setModalEditOpen(false),
                                        className: "text-lumina-muted hover:text-white text-xl",
                                        children: "✕"
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 514,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 512,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                onSubmit: submitEditTransaction,
                                className: "space-y-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-2 gap-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "date",
                                                required: true,
                                                className: "input-luxury",
                                                value: editFormData.date,
                                                onChange: (e)=>setEditFormData({
                                                        ...editFormData,
                                                        date: e.target.value
                                                    })
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 518,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                className: "input-luxury font-bold",
                                                value: editFormData.account_id,
                                                onChange: (e)=>setEditFormData({
                                                        ...editFormData,
                                                        account_id: e.target.value
                                                    }),
                                                disabled: editingTransaction?.ref_type?.includes('transfer'),
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        children: "-- Select Wallet --"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 520,
                                                        columnNumber: 37
                                                    }, this),
                                                    accounts.map((a)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                            value: a.id,
                                                            children: a.name
                                                        }, a.id, false, {
                                                            fileName: "[project]/app/cash/page.js",
                                                            lineNumber: 521,
                                                            columnNumber: 54
                                                        }, this))
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 519,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 517,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        required: true,
                                        className: "input-luxury",
                                        value: editFormData.category,
                                        onChange: (e)=>setEditFormData({
                                                ...editFormData,
                                                category: e.target.value
                                            }),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-- Select Category --"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 525,
                                                columnNumber: 33
                                            }, this),
                                            categories.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: c.name,
                                                    children: c.name
                                                }, c.id, false, {
                                                    fileName: "[project]/app/cash/page.js",
                                                    lineNumber: 526,
                                                    columnNumber: 52
                                                }, this)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "Lainnya",
                                                children: "Lainnya"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 527,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 524,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                        required: true,
                                        className: "input-luxury",
                                        placeholder: "Description...",
                                        rows: "3",
                                        value: editFormData.description,
                                        onChange: (e)=>setEditFormData({
                                                ...editFormData,
                                                description: e.target.value
                                            })
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 529,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "number",
                                        required: true,
                                        className: "input-luxury font-bold text-lg text-lumina-gold placeholder-lumina-muted",
                                        placeholder: "Amount (Rp)",
                                        value: editFormData.amount,
                                        onChange: (e)=>setEditFormData({
                                                ...editFormData,
                                                amount: e.target.value
                                            })
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 530,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex justify-between gap-3 pt-4 border-t border-lumina-border",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: handleDeleteTransaction,
                                                className: "btn-ghost-dark hover:bg-red-900/30 hover:border-red-500/50 hover:text-red-400 transition-colors",
                                                children: "🗑️ Delete"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 532,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: ()=>setModalEditOpen(false),
                                                        className: "btn-ghost-dark",
                                                        children: "Cancel"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 534,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "submit",
                                                        className: "btn-gold",
                                                        children: "Update"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 535,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 533,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 531,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 516,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 511,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/cash/page.js",
                    lineNumber: 510,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/cash/page.js",
                lineNumber: 508,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$usePortal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
                children: modalExpOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center mb-6 pb-4 border-b border-lumina-border",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-lg font-bold text-white",
                                        children: "Record Transaction"
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 549,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>setModalExpOpen(false),
                                        className: "text-lumina-muted hover:text-white text-xl",
                                        children: "✕"
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 550,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 548,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                onSubmit: submitTransaction,
                                className: "space-y-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-2 gap-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "date",
                                                required: true,
                                                className: "input-luxury",
                                                value: formData.date,
                                                onChange: (e)=>setFormData({
                                                        ...formData,
                                                        date: e.target.value
                                                    })
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 554,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                className: "input-luxury font-bold",
                                                value: formData.type,
                                                onChange: (e)=>setFormData({
                                                        ...formData,
                                                        type: e.target.value
                                                    }),
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "out",
                                                        children: "Expense (Keluar)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 556,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "in",
                                                        children: "Income (Masuk)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 557,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 555,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 553,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        required: true,
                                        className: "input-luxury",
                                        value: formData.account_id,
                                        onChange: (e)=>setFormData({
                                                ...formData,
                                                account_id: e.target.value
                                            }),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-- Select Wallet --"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 561,
                                                columnNumber: 33
                                            }, this),
                                            accounts.map((a)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: a.id,
                                                    children: a.name
                                                }, a.id, false, {
                                                    fileName: "[project]/app/cash/page.js",
                                                    lineNumber: 562,
                                                    columnNumber: 50
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 560,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        required: true,
                                        className: "input-luxury",
                                        value: formData.category,
                                        onChange: (e)=>setFormData({
                                                ...formData,
                                                category: e.target.value
                                            }),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "-- Select Category --"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 565,
                                                columnNumber: 33
                                            }, this),
                                            categories.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: c.name,
                                                    children: c.name
                                                }, c.id, false, {
                                                    fileName: "[project]/app/cash/page.js",
                                                    lineNumber: 566,
                                                    columnNumber: 52
                                                }, this)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "Lainnya",
                                                children: "Lainnya"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 567,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 564,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        required: true,
                                        className: "input-luxury",
                                        placeholder: "Description...",
                                        value: formData.description,
                                        onChange: (e)=>setFormData({
                                                ...formData,
                                                description: e.target.value
                                            })
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 569,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "number",
                                        required: true,
                                        className: "input-luxury font-bold text-lg text-lumina-gold placeholder-lumina-muted",
                                        placeholder: "Amount (Rp)",
                                        value: formData.amount,
                                        onChange: (e)=>setFormData({
                                                ...formData,
                                                amount: e.target.value
                                            })
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 570,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex justify-end gap-3 pt-4 border-t border-lumina-border",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setModalExpOpen(false),
                                                className: "btn-ghost-dark",
                                                children: "Cancel"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 572,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "submit",
                                                className: "btn-gold",
                                                children: "Save Record"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 573,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 571,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 552,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 547,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/cash/page.js",
                    lineNumber: 546,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/cash/page.js",
                lineNumber: 544,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$usePortal$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
                children: modalTfOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center mb-6 pb-4 border-b border-lumina-border",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-lg font-bold text-white",
                                        children: "Transfer Funds"
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 586,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>setModalTfOpen(false),
                                        className: "text-lumina-muted hover:text-white text-xl",
                                        children: "✕"
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 587,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 585,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                onSubmit: submitTransfer,
                                className: "space-y-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-2 gap-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "text-xs font-bold text-lumina-muted uppercase mb-2 block",
                                                        children: "From"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 592,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                        required: true,
                                                        className: "input-luxury bg-rose-900/10 text-rose-400 border-rose-500/30",
                                                        value: tfData.from,
                                                        onChange: (e)=>setTfData({
                                                                ...tfData,
                                                                from: e.target.value
                                                            }),
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                value: "",
                                                                children: "Select"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 594,
                                                                columnNumber: 41
                                                            }, this),
                                                            accounts.map((a)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                    value: a.id,
                                                                    children: a.name
                                                                }, a.id, false, {
                                                                    fileName: "[project]/app/cash/page.js",
                                                                    lineNumber: 595,
                                                                    columnNumber: 58
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 593,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 591,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "text-xs font-bold text-lumina-muted uppercase mb-2 block",
                                                        children: "To"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 599,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                        required: true,
                                                        className: "input-luxury bg-emerald-900/10 text-emerald-400 border-emerald-500/30",
                                                        value: tfData.to,
                                                        onChange: (e)=>setTfData({
                                                                ...tfData,
                                                                to: e.target.value
                                                            }),
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                value: "",
                                                                children: "Select"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/cash/page.js",
                                                                lineNumber: 601,
                                                                columnNumber: 41
                                                            }, this),
                                                            accounts.map((a)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                    value: a.id,
                                                                    children: a.name
                                                                }, a.id, false, {
                                                                    fileName: "[project]/app/cash/page.js",
                                                                    lineNumber: 602,
                                                                    columnNumber: 58
                                                                }, this))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/cash/page.js",
                                                        lineNumber: 600,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 598,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 590,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "number",
                                        required: true,
                                        className: "input-luxury font-bold text-lg text-white",
                                        placeholder: "Amount (Rp)",
                                        value: tfData.amount,
                                        onChange: (e)=>setTfData({
                                                ...tfData,
                                                amount: e.target.value
                                            })
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 606,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        className: "input-luxury",
                                        placeholder: "Notes...",
                                        value: tfData.note,
                                        onChange: (e)=>setTfData({
                                                ...tfData,
                                                note: e.target.value
                                            })
                                    }, void 0, false, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 607,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex justify-end gap-3 pt-4 border-t border-lumina-border",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: ()=>setModalTfOpen(false),
                                                className: "btn-ghost-dark",
                                                children: "Cancel"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 609,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "submit",
                                                className: "btn-gold",
                                                children: "Transfer"
                                            }, void 0, false, {
                                                fileName: "[project]/app/cash/page.js",
                                                lineNumber: 610,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/cash/page.js",
                                        lineNumber: 608,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/cash/page.js",
                                lineNumber: 589,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/cash/page.js",
                        lineNumber: 584,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/cash/page.js",
                    lineNumber: 583,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/cash/page.js",
                lineNumber: 581,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/cash/page.js",
        lineNumber: 381,
        columnNumber: 9
    }, this);
}
_s(CashFlowPage, "w2TQkrIXNdT5DX0j3USjWQ0pOcI=");
_c = CashFlowPage;
var _c;
__turbopack_context__.k.register(_c, "CashFlowPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_f5a91e2a._.js.map