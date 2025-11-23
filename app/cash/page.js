'use client';
import React from 'react';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';

export default function CashFlowPage() {
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ in: 0, out: 0 });
    const [expandedDates, setExpandedDates] = useState({}); // ✅ State untuk collapse/expand
    
    const [modalExpOpen, setModalExpOpen] = useState(false);
    const [modalTfOpen, setModalTfOpen] = useState(false);
    const [formData, setFormData] = useState({ type: 'out', account_id: '', category: '', amount: '', description: '', date: '' });
    const [tfData, setTfData] = useState({ from: '', to: '', amount: '', note: '' });
    const [categories, setCategories] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editAmount, setEditAmount] = useState('');
    const [modalEditOpen, setModalEditOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [editFormData, setEditFormData] = useState({ 
        date: '', 
        account_id: '', 
        category: '', 
        amount: '', 
        description: '' 
    });


    useEffect(() => { fetchData(); }, []);

    // ✅ Real-time listener untuk categories dari chart_of_accounts
    useEffect(() => {
        const q = query(collection(db, "chart_of_accounts"), orderBy("code"));
        const unsubscribe = onSnapshot(q, (snap) => {
            const cats = [];
            snap.forEach(d => {
                const c = d.data();
                if(c.category && (c.category.includes('Beban') || c.category.includes('Pendapatan'))) {
                    cats.push({ id: d.id, name: c.name, category: c.category });
                }
            });
            setCategories(cats);
        });
        return () => unsubscribe();
    }, []);

    const fetchData = async () => {
        try {
            const [accSnap, transSnap] = await Promise.all([
                getDocs(query(collection(db, "cash_accounts"), orderBy("created_at"))),
                getDocs(query(collection(db, "cash_transactions"), orderBy("date", "desc"), limit(50)))
            ]);
            
            const accList = []; 
            accSnap.forEach(d => accList.push({id: d.id, ...d.data()}));
            setAccounts(accList);

            const transList = []; 
            let totalIn = 0, totalOut = 0;
            transSnap.forEach(d => {
                const t = d.data();
                transList.push({id: d.id, ...t});
                if(t.type === 'in') totalIn += (t.amount||0);
                else totalOut += (t.amount||0);
            });
            setTransactions(transList);
            setSummary({ in: totalIn, out: totalOut });
        } catch(e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
        }
    };

    const submitTransaction = async (e) => {
        e.preventDefault();
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
            fetchData();
        } catch(e) { 
            alert(e.message); 
        }
    };

    const submitTransfer = async (e) => {
        e.preventDefault();
        if(tfData.from === tfData.to) return alert("Akun sama!");
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
                t.set(logRef, { 
                    type: 'transfer', 
                    amount: amt, 
                    date: serverTimestamp(), 
                    description: `To ${toDoc.data().name}: ${tfData.note}`, 
                    account_id: tfData.from, 
                    ref_type: 'transfer_out' 
                });
                
                const logRefIn = doc(collection(db, "cash_transactions"));
                t.set(logRefIn, { 
                    type: 'transfer', 
                    amount: amt, 
                    date: serverTimestamp(), 
                    description: `From ${fromDoc.data().name}: ${tfData.note}`, 
                    account_id: tfData.to, 
                    ref_type: 'transfer_in' 
                });
            });
            setModalTfOpen(false); 
            setTfData({ from: '', to: '', amount: '', note: '' });
            fetchData();
        } catch(e) { 
            alert(e.message); 
        }
    };

    // ✅ Helper function - Separate settlement dan non-settlement transactions
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

    // ✅ Helper function to group transactions by date (untuk settlement saja)
    const groupTransactionsByDate = (transactions) => {
        const grouped = {};
        
        transactions.forEach((transaction) => {
            const date = new Date(transaction.date.toDate()).toLocaleDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(transaction);
        });
        
        return Object.entries(grouped)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([date, items]) => ({
                date,
                items
            }));
    };

    // ✅ Toggle function untuk collapse/expand
    const toggleDateExpand = (date) => {
        setExpandedDates(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

    // ✅ Auto-expand tanggal pertama (untuk settlement)
    useEffect(() => {
        if(transactions.length > 0) {
            const { settlementTransactions } = separateTransactions(transactions);
            if(settlementTransactions.length > 0 && Object.keys(expandedDates).length === 0) {
                const firstDate = groupTransactionsByDate(settlementTransactions)[0]?.date;
                if(firstDate) {
                    setExpandedDates({ [firstDate]: true });
                }
            }
        }
    }, [transactions]);

    // ✅ Open edit modal dengan data transaction
    const handleOpenEditModal = (transaction) => {
        setEditingTransaction(transaction);
        setEditFormData({
            date: new Date(transaction.date.toDate()).toISOString().split('T')[0],
            account_id: transaction.account_id,
            category: transaction.category || '',
            amount: transaction.amount.toString(),
            description: transaction.description
        });
        setModalEditOpen(true);
    };

    // ✅ FIXED - Function untuk save edit transaction (READ dulu, baru WRITE)
    const submitEditTransaction = async (e) => {
        e.preventDefault();
        try {
            const newAmount = parseInt(editFormData.amount);
            const oldAmount = editingTransaction.amount;
            
            await runTransaction(db, async (t) => {
                // ✅ STEP 1: READ semua data yang diperlukan DULU
                const transRef = doc(db, "cash_transactions", editingTransaction.id);
                const accRef = doc(db, "cash_accounts", editFormData.account_id);
                const accDoc = await t.get(accRef);
                
                // Jika account berubah, baca old account juga
                let oldAccDoc = null;
                if(editFormData.account_id !== editingTransaction.account_id) {
                    const oldAccRef = doc(db, "cash_accounts", editingTransaction.account_id);
                    oldAccDoc = await t.get(oldAccRef);
                }
                
                // ✅ STEP 2: Setelah semua READ selesai, mulai WRITE
                
                // Update transaction
                t.update(transRef, {
                    date: new Date(editFormData.date),
                    account_id: editFormData.account_id,
                    category: editFormData.category,
                    amount: newAmount,
                    description: editFormData.description
                });
                
                // Hitung new balance untuk current/new account
                let currentBalance = accDoc.data().balance || 0;
                const isInc = editingTransaction.type === 'in' || editingTransaction.ref_type === 'transfer_in';
                
                // Undo old amount
                let newBalance = isInc 
                    ? currentBalance - oldAmount 
                    : currentBalance + oldAmount;
                
                // Apply new amount
                newBalance = isInc 
                    ? newBalance + newAmount 
                    : newBalance - newAmount;
                
                // Update current account balance
                t.update(accRef, { balance: newBalance });
                
                // Jika account berubah, update old account juga
                if(editFormData.account_id !== editingTransaction.account_id) {
                    const oldAccRef = doc(db, "cash_accounts", editingTransaction.account_id);
                    let oldAccBalance = oldAccDoc.data().balance || 0;
                    
                    // Undo dari old account
                    oldAccBalance = isInc 
                        ? oldAccBalance - oldAmount 
                        : oldAccBalance + oldAmount;
                    
                    t.update(oldAccRef, { balance: oldAccBalance });
                }
            });
            
            setModalEditOpen(false);
            setEditingTransaction(null);
            setEditFormData({ date: '', account_id: '', category: '', amount: '', description: '' });
            fetchData();
        } catch(e) {
            alert('Error: ' + e.message);
        }
    };

    // ✅ FIXED - Function untuk delete transaction (READ dulu, baru DELETE)
    const handleDeleteTransaction = async () => {
        if(!confirm('Yakin ingin menghapus transaksi ini?')) return;
        
        try {
            await runTransaction(db, async (t) => {
                // ✅ STEP 1: READ semua data DULU sebelum DELETE/WRITE
                const transRef = doc(db, "cash_transactions", editingTransaction.id);
                const accRef = doc(db, "cash_accounts", editingTransaction.account_id);
                const transDoc = await t.get(transRef);
                const accDoc = await t.get(accRef);
                
                // ✅ STEP 2: Setelah semua READ selesai, baru DELETE/WRITE
                
                // Delete transaction
                t.delete(transRef);
                
                // Undo balance
                const isInc = editingTransaction.type === 'in' || editingTransaction.ref_type === 'transfer_in';
                const currentBalance = accDoc.data().balance || 0;
                const newBalance = isInc 
                    ? currentBalance - editingTransaction.amount 
                    : currentBalance + editingTransaction.amount;
                
                // Update account balance
                t.update(accRef, { balance: newBalance });
            });
            
            setModalEditOpen(false);
            setEditingTransaction(null);
            fetchData();
        } catch(e) {
            alert('Error: ' + e.message);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 fade-in pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-display font-bold text-lumina-text">Cash Flow</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Manage wallets & transactions.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModalTfOpen(true)} className="btn-ghost-dark text-xs">Transfer</button>
                    <button onClick={() => { setFormData({type:'out', date: new Date().toISOString().split('T')[0], account_id:'', category:'', amount:'', description:''}); setModalExpOpen(true); }} className="btn-gold">Record Transaction</button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {accounts.map(acc => (
                    <div key={acc.id} className="card-luxury p-6 flex flex-col justify-between relative overflow-hidden group hover:border-lumina-gold/50 transition-all">
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold text-lumina-muted uppercase tracking-wider mb-1">{acc.name}</p>
                            <h3 className="text-2xl font-display font-bold text-white tracking-tight">{formatRupiah(acc.balance)}</h3>
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
                        {/* ✅ RENDER NORMAL TRANSACTIONS FIRST (tanpa grouping) */}
                        {(() => {
                            const { settlementTransactions, normalTransactions } = separateTransactions(transactions);
                            
                            return (
                                <>
                                    {/* NORMAL TRANSACTIONS - Seluruh row clickable */}
                                    {normalTransactions.map(t => {
                                        const isInc = t.type === 'in' || t.ref_type === 'transfer_in';
                                        
                                        return (
                                            <tr 
                                                key={t.id}
                                                onClick={() => handleOpenEditModal(t)}
                                                className="hover:bg-lumina-highlight/20 transition-colors border-b border-lumina-border/30 cursor-pointer group"
                                            >
                                                <td></td>
                                                <td className="pl-2 font-mono text-xs text-lumina-muted">{new Date(t.date.toDate()).toLocaleDateString()}</td>
                                                <td className="font-medium text-lumina-text text-xs">{accounts.find(a=>a.id===t.account_id)?.name || 'Unknown'}</td>
                                                <td><span className="badge-luxury badge-neutral">{t.category || 'General'}</span></td>
                                                <td className="text-lumina-muted truncate max-w-xs text-sm">{t.description}</td>
                                                <td className={`text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'} group-hover:text-lumina-gold transition-colors`}>
                                                    {isInc ? '+' : '-'}{formatRupiah(t.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* SETTLEMENT TRANSACTIONS - Dengan grouping dan collapse */}
                                    {groupTransactionsByDate(settlementTransactions).map((group) => {
                                        // ✅ Hitung total amount untuk group ini
                                        const groupTotal = group.items.reduce((sum, item) => sum + (item.amount || 0), 0);
                                        const isInc = groupTotal >= 0;
                                        
                                        return (
                                            <React.Fragment key={group.date}>
                                                {/* ✅ HEADER ROW - Header + Summary pada baris yang sama */}
                                                <tr 
                                                    onClick={() => toggleDateExpand(group.date)}
                                                    className="bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer border-t-2 border-lumina-gold/40 transition-colors group/header"
                                                >
                                                    <td className="pl-6 text-center">
                                                        <span className={`inline-block transition-transform duration-300 text-lumina-gold ${expandedDates[group.date] ? 'rotate-180' : ''}`}>
                                                            ▼
                                                        </span>
                                                    </td>
                                                    <td className="pl-2 py-3">
                                                        <span className="font-semibold text-lumina-gold text-sm">{group.date}</span>
                                                    </td>
                                                    <td colSpan="2">
                                                        <span className="text-xs text-white bg-orange-600/40 px-3 py-1 rounded border border-orange-500/50">
                                                            Total Settlement • {group.items.length} invoice
                                                        </span>
                                                    </td>
                                                    <td className="text-lumina-muted text-sm">
                                                        Settlement sales date {group.date}
                                                    </td>
                                                    <td className={`text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'}`}>
                                                        {isInc ? '+' : ''}{formatRupiah(groupTotal)}
                                                    </td>
                                                </tr>

                                                {/* Settlement Transaction Items - Seluruh row clickable */}
                                                {expandedDates[group.date] && group.items.map(t => {
                                                    const isInc = t.type === 'in' || t.ref_type === 'transfer_in';
                                                    
                                                    return (
                                                        <tr 
                                                            key={t.id}
                                                            onClick={() => handleOpenEditModal(t)}
                                                            className="hover:bg-orange-900/20 transition-colors border-b border-lumina-border/30 bg-gray-900/50 cursor-pointer group"
                                                        >
                                                            <td></td>
                                                            <td className="pl-2 font-mono text-xs text-lumina-muted">{new Date(t.date.toDate()).toLocaleDateString()}</td>
                                                            <td className="font-medium text-lumina-text text-xs">{accounts.find(a=>a.id===t.account_id)?.name || 'Unknown'}</td>
                                                            <td><span className="badge-luxury badge-neutral text-orange-300 bg-orange-900/30 border-orange-600/50">{t.category || 'General'}</span></td>
                                                            <td className="text-lumina-muted truncate max-w-xs text-sm italic">{t.description}</td>
                                                            <td className={`text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-lumina-text'} group-hover:text-lumina-gold transition-colors`}>
                                                                {isInc ? '+' : '-'}{formatRupiah(t.amount)}
                                                            </td>
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

            {/* Modal Edit Transaction */}
            <Portal>
            {modalEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-white">Edit Transaction</h3>
                            <button onClick={() => setModalEditOpen(false)} className="text-lumina-muted hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={submitEditTransaction} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input 
                                    type="date" 
                                    required 
                                    className="input-luxury" 
                                    value={editFormData.date} 
                                    onChange={e=>setEditFormData({...editFormData, date:e.target.value})} 
                                />
                                <select 
                                    className="input-luxury font-bold" 
                                    value={editFormData.account_id} 
                                    onChange={e=>setEditFormData({...editFormData, account_id:e.target.value})}
                                    disabled={editingTransaction?.ref_type === 'transfer_in' || editingTransaction?.ref_type === 'transfer_out'}
                                >
                                    <option value="">-- Select Wallet --</option>
                                    {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            
                            <select 
                                required 
                                className="input-luxury" 
                                value={editFormData.category} 
                                onChange={e=>setEditFormData({...editFormData, category:e.target.value})}
                            >
                                <option value="">-- Select Category --</option>
                                {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                                <option value="Lainnya">Lainnya</option>
                            </select>
                            
                            <textarea 
                                required 
                                className="input-luxury" 
                                placeholder="Description..." 
                                rows="3"
                                value={editFormData.description} 
                                onChange={e=>setEditFormData({...editFormData, description:e.target.value})} 
                            />
                            
                            <input 
                                type="number" 
                                required 
                                className="input-luxury font-bold text-lg text-lumina-gold placeholder-lumina-muted" 
                                placeholder="Amount (Rp)" 
                                value={editFormData.amount} 
                                onChange={e=>setEditFormData({...editFormData, amount:e.target.value})} 
                            />

                            {/* Info box showing old vs new */}
                            {editingTransaction && (
                                <div className="bg-lumina-highlight/30 border border-lumina-gold/30 rounded p-3 text-xs space-y-1">
                                    <p className="text-lumina-muted">Previous Amount: <span className="text-lumina-text font-bold">{formatRupiah(editingTransaction.amount)}</span></p>
                                    <p className="text-lumina-gold">New Amount: <span className="font-bold">{formatRupiah(parseInt(editFormData.amount) || 0)}</span></p>
                                </div>
                            )}
                            
                            <div className="flex justify-between gap-3 pt-4 border-t border-lumina-border">
                                <button 
                                    type="button" 
                                    onClick={handleDeleteTransaction}
                                    className="btn-ghost-dark hover:bg-red-900/30 hover:border-red-500/50 hover:text-red-400 transition-colors"
                                >
                                    🗑️ Delete
                                </button>
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

            {/* Modal Expense */}
            <Portal>
            {modalExpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-white">Record Transaction</h3>
                            <button onClick={() => setModalExpOpen(false)} className="text-lumina-muted hover:text-white text-xl">✕</button>
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
                                {/* ✅ REAL-TIME DINAMIS dari chart_of_accounts */}
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
            
            {/* Modal Transfer */}
            <Portal>
            {modalTfOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-white">Transfer Funds</h3>
                            <button onClick={() => setModalTfOpen(false)} className="text-lumina-muted hover:text-white text-xl">✕</button>
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
                            <input type="number" required className="input-luxury font-bold text-lg text-white" placeholder="Amount (Rp)" value={tfData.amount} onChange={e=>setTfData({...tfData, amount:e.target.value})} />
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
