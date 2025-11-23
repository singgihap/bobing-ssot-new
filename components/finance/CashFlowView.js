// app/cash/page.js
"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';

export default function CashFlowPage() {
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ in: 0, out: 0 });
    
    const [modalExpOpen, setModalExpOpen] = useState(false);
    const [modalTfOpen, setModalTfOpen] = useState(false);
    const [formData, setFormData] = useState({ type: 'out', account_id: '', category: '', amount: '', description: '', date: '' });
    const [tfData, setTfData] = useState({ from: '', to: '', amount: '', note: '' });
    const [categories, setCategories] = useState([]);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [accSnap, coaSnap] = await Promise.all([
                getDocs(query(collection(db, "cash_accounts"), orderBy("created_at"))),
                getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")))
            ]);
            const accList = []; accSnap.forEach(d => accList.push({id:d.id, ...d.data()}));
            setAccounts(accList);
            const cats = []; coaSnap.forEach(d => { const c = d.data(); if(c.category.includes('Beban') || c.category.includes('Pendapatan')) cats.push(c); });
            setCategories(cats);
            await fetchTransactions();
        } catch(e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchTransactions = async () => {
        const q = query(collection(db, "cash_transactions"), orderBy("date", "desc"), limit(50));
        const snap = await getDocs(q);
        const list = []; let totalIn = 0, totalOut = 0;
        snap.forEach(d => {
            const t = d.data();
            list.push({id: d.id, ...t});
            if(t.type === 'in') totalIn += (t.amount||0); else totalOut += (t.amount||0);
        });
        setTransactions(list);
        setSummary({ in: totalIn, out: totalOut });
    };

    const submitTransaction = async (e) => {
        e.preventDefault();
        try {
            const amt = parseInt(formData.amount);
            await runTransaction(db, async (t) => {
                const ref = doc(collection(db, "cash_transactions"));
                t.set(ref, { ...formData, amount: amt, date: new Date(formData.date), created_at: serverTimestamp(), ref_type: 'manual_entry' });
                const accRef = doc(db, "cash_accounts", formData.account_id);
                const accDoc = await t.get(accRef);
                const newBal = formData.type === 'in' ? (accDoc.data().balance||0) + amt : (accDoc.data().balance||0) - amt;
                t.update(accRef, { balance: newBal });
            });
            setModalExpOpen(false); fetchData();
        } catch(e) { alert(e.message); }
    };

    const submitTransfer = async (e) => {
        e.preventDefault();
        if(tfData.from === tfData.to) return alert("Akun sama!");
        try {
            const amt = parseInt(tfData.amount);
            await runTransaction(db, async (t) => {
                const fromRef = doc(db, "cash_accounts", tfData.from);
                const toRef = doc(db, "cash_accounts", tfData.to);
                const fromDoc = await t.get(fromRef); const toDoc = await t.get(toRef);
                t.update(fromRef, { balance: (fromDoc.data().balance||0) - amt });
                t.update(toRef, { balance: (toDoc.data().balance||0) + amt });
                const logRef = doc(collection(db, "cash_transactions"));
                t.set(logRef, { type: 'transfer', amount: amt, date: serverTimestamp(), description: `To ${toDoc.data().name}: ${tfData.note}`, account_id: tfData.from, ref_type: 'transfer_out' });
                const logRefIn = doc(collection(db, "cash_transactions"));
                t.set(logRefIn, { type: 'transfer', amount: amt, date: serverTimestamp(), description: `From ${fromDoc.data().name}: ${tfData.note}`, account_id: tfData.to, ref_type: 'transfer_in' });
            });
            setModalTfOpen(false); fetchData();
        } catch(e) { alert(e.message); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 fade-in pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Cash Flow</h2>
                    <p className="text-sm text-gray-500">Manage wallets & transactions.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setModalTfOpen(true)} className="btn-secondary">Transfer</button>
                    <button onClick={() => { setFormData({type:'out', date: new Date().toISOString().split('T')[0], account_id:'', category:'', amount:'', description:''}); setModalExpOpen(true); }} className="btn-primary">Record Transaction</button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {accounts.map(acc => (
                    <div key={acc.id} className="card p-6 flex flex-col justify-between relative overflow-hidden group hover:border-brand-200">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{acc.name}</p>
                            <h3 className="text-2xl font-extrabold text-gray-900">{formatRupiah(acc.balance)}</h3>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                            <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">{acc.code}</span>
                        </div>
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-brand-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Recent Transactions</h3>
                    <div className="text-xs font-medium text-gray-500">Last 50 entries</div>
                </div>
                <div className="table-wrapper border-0 shadow-none rounded-none">
                    <table className="table-modern">
                        <thead><tr><th className="pl-6">Date</th><th>Wallet</th><th>Category</th><th>Description</th><th className="text-right pr-6">Amount</th></tr></thead>
                        <tbody>
                            {transactions.map(t => {
                                const isInc = t.type === 'in' || t.ref_type === 'transfer_in';
                                return (
                                    <tr key={t.id}>
                                        <td className="pl-6 font-mono text-xs text-gray-500">{new Date(t.date.toDate()).toLocaleDateString()}</td>
                                        <td className="font-bold text-gray-700 text-xs">{accounts.find(a=>a.id===t.account_id)?.name || 'Unknown'}</td>
                                        <td><span className="badge badge-neutral">{t.category || 'General'}</span></td>
                                        <td className="text-gray-600 truncate max-w-xs">{t.description}</td>
                                        <td className={`text-right pr-6 font-mono font-bold ${isInc ? 'text-emerald-600' : 'text-gray-900'}`}>
                                            {isInc ? '+' : '-'}{formatRupiah(t.amount)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Expense */}
            {modalExpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 fade-in-up">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">Record Transaction</h3>
                        <form onSubmit={submitTransaction} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" required className="input-field" value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} />
                                <select className="select-field font-bold" value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value})}>
                                    <option value="out">Expense (Keluar)</option>
                                    <option value="in">Income (Masuk)</option>
                                </select>
                            </div>
                            <select required className="select-field" value={formData.account_id} onChange={e=>setFormData({...formData, account_id:e.target.value})}>
                                <option value="">-- Select Wallet --</option>
                                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <select required className="select-field" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                                <option value="">-- Select Category --</option>
                                {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                                <option value="Lainnya">Lainnya</option>
                            </select>
                            <input required className="input-field" placeholder="Description..." value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})} />
                            <input type="number" required className="input-field font-bold text-lg text-brand-600" placeholder="Amount (Rp)" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} />
                            
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={()=>setModalExpOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" className="btn-primary">Save Record</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Transfer */}
            {modalTfOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 fade-in-up">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">Transfer Funds</h3>
                        <form onSubmit={submitTransfer} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase mb-1">From</label><select required className="select-field bg-red-50" value={tfData.from} onChange={e=>setTfData({...tfData, from:e.target.value})}><option value="">Select</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase mb-1">To</label><select required className="select-field bg-emerald-50" value={tfData.to} onChange={e=>setTfData({...tfData, to:e.target.value})}><option value="">Select</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                            </div>
                            <input type="number" required className="input-field font-bold text-lg" placeholder="Amount" value={tfData.amount} onChange={e=>setTfData({...tfData, amount:e.target.value})} />
                            <input className="input-field" placeholder="Notes..." value={tfData.note} onChange={e=>setTfData({...tfData, note:e.target.value})} />
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={()=>setModalTfOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" className="btn-primary">Transfer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}