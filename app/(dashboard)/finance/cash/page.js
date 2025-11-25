// app/cash/page.js
'use client';
import React from 'react';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, serverTimestamp, where } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_KEY_DATA = 'lumina_cash_data_v2'; // Accounts & Transactions
const CACHE_KEY_CATS = 'lumina_cash_categories_v2';
const CACHE_DURATION = 5 * 60 * 1000; // 5 Menit

// Cache Key External untuk di-reuse
const CACHE_KEY_POS = 'lumina_pos_master_v2'; 

export default function CashFlowPage() {
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ in: 0, out: 0 });
    const [expandedDates, setExpandedDates] = useState({}); 
    
    const [modalExpOpen, setModalExpOpen] = useState(false);
    const [modalTfOpen, setModalTfOpen] = useState(false);
    const [formData, setFormData] = useState({ type: 'out', account_id: '', category: '', amount: '', description: '', date: '' });
    const [tfData, setTfData] = useState({ from: '', to: '', amount: '', note: '' });
    const [categories, setCategories] = useState([]);
    
    // Edit States
    const [modalEditOpen, setModalEditOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [editFormData, setEditFormData] = useState({ 
        date: '', account_id: '', category: '', amount: '', description: '' 
    });

    // Helper: Invalidate Cache Relevan
    const invalidateRelatedCaches = () => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(CACHE_KEY_DATA); // Refresh halaman ini
        localStorage.removeItem('lumina_dash_master_v2'); // Refresh Dashboard (Saldo berubah)
        localStorage.removeItem('lumina_pos_master_v2'); // Refresh POS (Saldo akun berubah)
    };

    useEffect(() => { 
        fetchData(); 
        fetchCategories(); 
    }, []);

    // 1. Fetch Categories (Optimized)
    const fetchCategories = async () => {
        if (typeof window === 'undefined') return;
        
        const cached = localStorage.getItem(CACHE_KEY_CATS);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < 30 * 60 * 1000) { // 30 menit untuk kategori (jarang berubah)
                setCategories(data);
                return;
            }
        }

        try {
            const q = query(collection(db, "chart_of_accounts"), orderBy("code"));
            const snap = await getDocs(q);
            const cats = [];
            snap.forEach(d => {
                const c = d.data();
                if(c.category && (c.category.includes('Beban') || c.category.includes('Pendapatan'))) {
                    cats.push({ id: d.id, name: c.name, category: c.category });
                }
            });
            setCategories(cats);
            localStorage.setItem(CACHE_KEY_CATS, JSON.stringify({ data: cats, ts: Date.now() }));
        } catch(e) { console.error(e); }
    };

    // 2. Fetch Data Utama (Accounts & Transactions)
    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            let accList = [];
            let transList = [];
            let loadedFromCache = false;

            // A. Cek Cache LocalStorage
            if (!forceRefresh && typeof window !== 'undefined') {
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
            if (!loadedFromCache && accList.length === 0 && typeof window !== 'undefined') {
                const cachedPos = localStorage.getItem(CACHE_KEY_POS);
                if (cachedPos) {
                    try {
                        const parsed = JSON.parse(cachedPos);
                        if (parsed.data?.acc && Date.now() - parsed.ts < 60 * 60 * 1000) {
                            accList = parsed.data.acc; // Hemat Reads!
                        }
                    } catch(e) {}
                }
            }

            // C. Fetch Firebase jika belum lengkap
            const promises = [];
            if (accList.length === 0) promises.push(getDocs(query(collection(db, "cash_accounts"), orderBy("created_at"))));
            if (!loadedFromCache) promises.push(getDocs(query(collection(db, "cash_transactions"), orderBy("date", "desc"), limit(50))));

            if (promises.length > 0) {
                const results = await Promise.all(promises);
                let idx = 0;

                if (accList.length === 0) {
                    const accSnap = results[idx++];
                    accList = [];
                    accSnap.forEach(d => accList.push({id: d.id, ...d.data()}));
                }

                if (!loadedFromCache) {
                    const transSnap = results[idx];
                    transList = [];
                    transSnap.forEach(d => {
                        const t = d.data();
                        transList.push({
                            id: d.id, 
                            ...t, 
                            date: t.date?.toDate ? t.date.toDate().toISOString() : t.date
                        });
                    });
                }

                // Simpan Cache Baru
                if (typeof window !== 'undefined') {
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
            transList.forEach(t => {
                if(t.type === 'in') totalIn += (t.amount||0);
                else totalOut += (t.amount||0);
            });
            setSummary({ in: totalIn, out: totalOut });

        } catch(e) { 
            console.error(e); 
            toast.error("Gagal memuat data kas");
        } finally { 
            setLoading(false); 
        }
    };

    const submitTransaction = async (e) => {
        e.preventDefault();
        const toastId = toast.loading("Menyimpan...");
        try {
            const amt = parseInt(formData.amount);
            await runTransaction(db, async (t) => {
                const ref = doc(collection(db, "cash_transactions"));
                t.set(ref, { 
                    ...formData, 
                    amount: amt, 
                    date: new Date(formData.date), 
                    created_at: serverTimestamp(), 
                    ref_type: 'manual_entry' 
                });
                
                const accRef = doc(db, "cash_accounts", formData.account_id);
                const accDoc = await t.get(accRef);
                const newBal = formData.type === 'in' 
                    ? (accDoc.data().balance||0) + amt 
                    : (accDoc.data().balance||0) - amt;
                t.update(accRef, { balance: newBal });
            });
            
            setModalExpOpen(false); 
            setFormData({ type: 'out', account_id: '', category: '', amount: '', description: '', date: '' });
            
            invalidateRelatedCaches();
            toast.success("Transaksi disimpan!", { id: toastId });
            fetchData(true); 
        } catch(e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    const submitTransfer = async (e) => {
        e.preventDefault();
        if(tfData.from === tfData.to) return toast.error("Akun asal dan tujuan tidak boleh sama!");
        const toastId = toast.loading("Transferring...");
        try {
            const amt = parseInt(tfData.amount);
            await runTransaction(db, async (t) => {
                const fromRef = doc(db, "cash_accounts", tfData.from);
                const toRef = doc(db, "cash_accounts", tfData.to);
                const fromDoc = await t.get(fromRef); 
                const toDoc = await t.get(toRef);
                
                t.update(fromRef, { balance: (fromDoc.data().balance||0) - amt });
                t.update(toRef, { balance: (toDoc.data().balance||0) + amt });
                
                const logRef = doc(collection(db, "cash_transactions"));
                t.set(logRef, { type: 'transfer', amount: amt, date: serverTimestamp(), description: `To ${toDoc.data().name}: ${tfData.note}`, account_id: tfData.from, ref_type: 'transfer_out' });
                
                const logRefIn = doc(collection(db, "cash_transactions"));
                t.set(logRefIn, { type: 'transfer', amount: amt, date: serverTimestamp(), description: `From ${fromDoc.data().name}: ${tfData.note}`, account_id: tfData.to, ref_type: 'transfer_in' });
            });
            
            setModalTfOpen(false); 
            setTfData({ from: '', to: '', amount: '', note: '' });
            
            invalidateRelatedCaches();
            toast.success("Transfer Berhasil!", { id: toastId });
            fetchData(true);
        } catch(e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    // --- HELPER DATA PROCESSING ---
    const getDateObj = (dateItem) => {
        // Handle Firestore Timestamp OR ISO String (from Cache)
        if(!dateItem) return new Date();
        return dateItem.toDate ? dateItem.toDate() : new Date(dateItem);
    };

    const separateTransactions = (transactions) => {
        const settlementTransactions = [];
        const normalTransactions = [];
        transactions.forEach((transaction) => {
            if(transaction.description && transaction.description.toLowerCase().includes('settlement')) {
                settlementTransactions.push(transaction);
            } else {
                normalTransactions.push(transaction);
            }
        });
        return { settlementTransactions, normalTransactions };
    };

    const groupTransactionsByDate = (transactions) => {
        const grouped = {};
        transactions.forEach((transaction) => {
            const date = getDateObj(transaction.date).toLocaleDateString();
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(transaction);
        });
        return Object.entries(grouped)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([date, items]) => ({ date, items }));
    };

    const toggleDateExpand = (date) => setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));

    useEffect(() => {
        if(transactions.length > 0) {
            const { settlementTransactions } = separateTransactions(transactions);
            if(settlementTransactions.length > 0 && Object.keys(expandedDates).length === 0) {
                const firstDate = groupTransactionsByDate(settlementTransactions)[0]?.date;
                if(firstDate) setExpandedDates({ [firstDate]: true });
            }
        }
    }, [transactions]);

    const handleOpenEditModal = (transaction) => {
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

    const submitEditTransaction = async (e) => {
        e.preventDefault();
        const toastId = toast.loading("Updating...");
        try {
            const newAmount = parseInt(editFormData.amount);
            const oldAmount = editingTransaction.amount;
            
            await runTransaction(db, async (t) => {
                const transRef = doc(db, "cash_transactions", editingTransaction.id);
                const accRef = doc(db, "cash_accounts", editFormData.account_id);
                const accDoc = await t.get(accRef);
                
                let oldAccDoc = null;
                if(editFormData.account_id !== editingTransaction.account_id) {
                    const oldAccRef = doc(db, "cash_accounts", editingTransaction.account_id);
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
                t.update(accRef, { balance: newBalance });
                
                if(editFormData.account_id !== editingTransaction.account_id) {
                    const oldAccRef = doc(db, "cash_accounts", editingTransaction.account_id);
                    let oldAccBalance = oldAccDoc.data().balance || 0;
                    oldAccBalance = isInc ? oldAccBalance - oldAmount : oldAccBalance + oldAmount;
                    t.update(oldAccRef, { balance: oldAccBalance });
                }
            });
            
            setModalEditOpen(false);
            setEditingTransaction(null);
            setEditFormData({ date: '', account_id: '', category: '', amount: '', description: '' });
            
            invalidateRelatedCaches();
            toast.success("Update Berhasil!", { id: toastId });
            fetchData(true);
        } catch(e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    const handleDeleteTransaction = async () => {
        if(!confirm('Yakin ingin menghapus transaksi ini?')) return;
        const toastId = toast.loading("Menghapus...");
        try {
            await runTransaction(db, async (t) => {
                const transRef = doc(db, "cash_transactions", editingTransaction.id);
                const accRef = doc(db, "cash_accounts", editingTransaction.account_id);
                const accDoc = await t.get(accRef);
                t.delete(transRef);
                
                const isInc = editingTransaction.type === 'in' || editingTransaction.ref_type === 'transfer_in';
                const currentBalance = accDoc.data().balance || 0;
                const newBalance = isInc 
                    ? currentBalance - editingTransaction.amount 
                    : currentBalance + editingTransaction.amount;
                t.update(accRef, { balance: newBalance });
            });
            
            setModalEditOpen(false);
            setEditingTransaction(null);
            
            invalidateRelatedCaches();
            toast.success("Dihapus!", { id: toastId });
            fetchData(true);
        } catch(e) { 
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId }); 
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 fade-in pb-20">
            <div className="flex justify-between items-center">
            <div>
                <h2 className="text-xl md:text-3xl font-display font-bold text-lumina-text">
                Cash Flow
                </h2>
                <p className="text-sm text-lumina-muted mt-1 font-light">
                Manage wallets & transactions.
                </p>
            </div>
            <div className="flex gap-2">
                <button
                onClick={() => setModalTfOpen(true)}
                className="btn-ghost-dark text-xs"
                >
                Transfer
                </button>
                <button
                onClick={() => {
                    setFormData({
                    type: 'out',
                    date: new Date().toISOString().split('T')[0],
                    account_id: '',
                    category: '',
                    amount: '',
                    description: ''
                    });
                    setModalExpOpen(true);
                }}
                className="btn-gold"
                >
                Record Transaction
                </button>
            </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {accounts.map(acc => (
                    <div key={acc.id} className="card-luxury p-6 flex flex-col justify-between relative overflow-hidden group hover:border-lumina-gold/50 transition-all">
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold text-lumina-muted uppercase tracking-wider mb-1">{acc.name}</p>
                            <h3 className="text-2xl font-display font-bold text-lumina-text tracking-tight">{formatRupiah(acc.balance)}</h3>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs text-lumina-muted relative z-10">
                            <span className="bg-lumina-highlight px-2 py-0.5 rounded font-mono text-lumina-gold">{acc.code}</span>
                        </div>
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-lumina-gold" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card-luxury overflow-hidden">
                <div className="px-6 py-4 border-b border-lumina-border bg-lumina-surface/50 flex justify-between items-center">
                    <h3 className="font-bold text-lumina-text text-sm uppercase tracking-wider">Recent Transactions</h3>
                    <div className="text-[10px] font-medium text-lumina-muted bg-lumina-highlight px-2 py-1 rounded">Last 50 entries</div>
                </div>
                <div className="table-wrapper-dark border-none shadow-none rounded-none">
                    <table className="table-dark">
                        <thead>
                            <tr>
                                <th className="pl-6 w-8"></th>
                                <th className="pl-2">Date</th>
                                <th>Wallet</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th className="text-right pr-6">Amount (Editable)</th>
                            </tr>
                        </thead>
                        <tbody>
                        {(() => {
                            const { settlementTransactions, normalTransactions } = separateTransactions(transactions);
                            return (
                                <>
                                    {normalTransactions.map(t => {
                                        const isInc = t.type === 'in' || t.ref_type === 'transfer_in';
                                        return (
                                            <tr key={t.id} onClick={() => handleOpenEditModal(t)} className="hover:bg-lumina-highlight/20 transition-colors border-b border-lumina-border/30 cursor-pointer group">
                                                <td></td>
                                                <td className="pl-2 font-mono text-xs text-lumina-muted">{getDateObj(t.date).toLocaleDateString()}</td>
                                                <td className="font-medium text-lumina-text text-xs">{accounts.find(a=>a.id===t.account_id)?.name || 'Unknown'}</td>
                                                <td><span className="badge-luxury badge-neutral">{t.category || 'General'}</span></td>
                                                <td className="text-lumina-muted truncate max-w-xs text-sm">{t.description}</td>
                                                <td className={`text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'} group-hover:text-lumina-gold transition-colors`}>
                                                    {isInc ? '+' : '-'}{formatRupiah(t.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {groupTransactionsByDate(settlementTransactions).map((group) => {
                                        const groupTotal = group.items.reduce((sum, item) => sum + (item.amount || 0), 0);
                                        const isInc = groupTotal >= 0;
                                        return (
                                            <React.Fragment key={group.date}>
                                                <tr onClick={() => toggleDateExpand(group.date)} className="bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer border-t-2 border-lumina-gold/40 transition-colors group/header">
                                                    <td className="pl-6 text-center"><span className={`inline-block transition-transform duration-300 text-lumina-gold ${expandedDates[group.date] ? 'rotate-180' : ''}`}>▼</span></td>
                                                    <td className="pl-2 py-3"><span className="font-semibold text-lumina-gold text-sm">{group.date}</span></td>
                                                    <td colSpan="2"><span className="text-xs text-lumina-text bg-orange-600/40 px-3 py-1 rounded border border-orange-500/50">Total Settlement • {group.items.length} invoice</span></td>
                                                    <td className="text-lumina-muted text-sm">Settlement sales date {group.date}</td>
                                                    <td className={`text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'}`}>{isInc ? '+' : ''}{formatRupiah(groupTotal)}</td>
                                                </tr>
                                                {expandedDates[group.date] && group.items.map(t => {
                                                    const isInc = t.type === 'in' || t.ref_type === 'transfer_in';
                                                    return (
                                                        <tr key={t.id} onClick={() => handleOpenEditModal(t)} className="hover:bg-orange-900/20 transition-colors border-b border-lumina-border/30 bg-gray-900/50 cursor-pointer group">
                                                            <td></td>
                                                            <td className="pl-2 font-mono text-xs text-lumina-muted">{getDateObj(t.date).toLocaleDateString()}</td>
                                                            <td className="font-medium text-lumina-text text-xs">{accounts.find(a=>a.id===t.account_id)?.name || 'Unknown'}</td>
                                                            <td><span className="badge-luxury badge-neutral text-orange-300 bg-orange-900/30 border-orange-600/50">{t.category || 'General'}</span></td>
                                                            <td className="text-lumina-muted truncate max-w-xs text-sm italic">{t.description}</td>
                                                            <td className={`text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'} group-hover:text-lumina-gold transition-colors`}>{isInc ? '+' : '-'}{formatRupiah(t.amount)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </>
                            );
                        })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALS (Edit, Expense, Transfer) code remains similar but using cleaned functions */}
            <Portal>
            {modalEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-lumina-surface/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-lumina-text">Edit Transaction</h3>
                            <button onClick={() => setModalEditOpen(false)} className="text-lumina-muted hover:text-lumina-text text-xl">✕</button>
                        </div>
                        <form onSubmit={submitEditTransaction} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" required className="input-luxury" value={editFormData.date} onChange={e=>setEditFormData({...editFormData, date:e.target.value})} />
                                <select className="input-luxury font-bold" value={editFormData.account_id} onChange={e=>setEditFormData({...editFormData, account_id:e.target.value})} disabled={editingTransaction?.ref_type?.includes('transfer')}>
                                    <option value="">-- Select Wallet --</option>
                                    {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <select required className="input-luxury" value={editFormData.category} onChange={e=>setEditFormData({...editFormData, category:e.target.value})}>
                                <option value="">-- Select Category --</option>
                                {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                                <option value="Lainnya">Lainnya</option>
                            </select>
                            <textarea required className="input-luxury" placeholder="Description..." rows="3" value={editFormData.description} onChange={e=>setEditFormData({...editFormData, description:e.target.value})} />
                            <input type="number" required className="input-luxury font-bold text-lg text-lumina-gold placeholder-lumina-muted" placeholder="Amount (Rp)" value={editFormData.amount} onChange={e=>setEditFormData({...editFormData, amount:e.target.value})} />
                            <div className="flex justify-between gap-3 pt-4 border-t border-lumina-border">
                                <button type="button" onClick={handleDeleteTransaction} className="btn-ghost-dark hover:bg-red-900/30 hover:border-red-500/50 hover:text-red-400 transition-colors">🗑️ Delete</button>
                                <div className="flex gap-3">
                                    <button type="button" onClick={()=>setModalEditOpen(false)} className="btn-ghost-dark">Cancel</button>
                                    <button type="submit" className="btn-gold">Update</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </Portal>

            <Portal>
            {modalExpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-lumina-surface/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-lumina-text">Record Transaction</h3>
                            <button onClick={() => setModalExpOpen(false)} className="text-lumina-muted hover:text-lumina-text text-xl">✕</button>
                        </div>
                        <form onSubmit={submitTransaction} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" required className="input-luxury" value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} />
                                <select className="input-luxury font-bold" value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value})}>
                                    <option value="out">Expense (Keluar)</option>
                                    <option value="in">Income (Masuk)</option>
                                </select>
                            </div>
                            <select required className="input-luxury" value={formData.account_id} onChange={e=>setFormData({...formData, account_id:e.target.value})}>
                                <option value="">-- Select Wallet --</option>
                                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <select required className="input-luxury" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                                <option value="">-- Select Category --</option>
                                {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                                <option value="Lainnya">Lainnya</option>
                            </select>
                            <input required className="input-luxury" placeholder="Description..." value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})} />
                            <input type="number" required className="input-luxury font-bold text-lg text-lumina-gold placeholder-lumina-muted" placeholder="Amount (Rp)" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} />
                            <div className="flex justify-end gap-3 pt-4 border-t border-lumina-border">
                                <button type="button" onClick={()=>setModalExpOpen(false)} className="btn-ghost-dark">Cancel</button>
                                <button type="submit" className="btn-gold">Save Record</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </Portal>
            
            <Portal>
            {modalTfOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-lumina-surface/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-lumina-text">Transfer Funds</h3>
                            <button onClick={() => setModalTfOpen(false)} className="text-lumina-muted hover:text-lumina-text text-xl">✕</button>
                        </div>
                        <form onSubmit={submitTransfer} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">From</label>
                                    <select required className="input-luxury bg-rose-900/10 text-rose-400 border-rose-500/30" value={tfData.from} onChange={e=>setTfData({...tfData, from:e.target.value})}>
                                        <option value="">Select</option>
                                        {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-lumina-muted uppercase mb-2 block">To</label>
                                    <select required className="input-luxury bg-emerald-900/10 text-emerald-400 border-emerald-500/30" value={tfData.to} onChange={e=>setTfData({...tfData, to:e.target.value})}>
                                        <option value="">Select</option>
                                        {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <input type="number" required className="input-luxury font-bold text-lg text-lumina-text" placeholder="Amount (Rp)" value={tfData.amount} onChange={e=>setTfData({...tfData, amount:e.target.value})} />
                            <input className="input-luxury" placeholder="Notes..." value={tfData.note} onChange={e=>setTfData({...tfData, note:e.target.value})} />
                            <div className="flex justify-end gap-3 pt-4 border-t border-lumina-border">
                                <button type="button" onClick={()=>setModalTfOpen(false)} className="btn-ghost-dark">Cancel</button>
                                <button type="submit" className="btn-gold">Transfer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}