// app/finance-accounts/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function CoaPage() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const q = query(collection(db, "chart_of_accounts"), orderBy("code", "asc"));
            const snap = await getDocs(q);
            const data = [];
            snap.forEach(d => data.push({id: d.id, ...d.data()}));
            setAccounts(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const toggleStatus = async (id, current) => {
        try {
            const newState = current === 'Aktif' ? 'Nonaktif' : 'Aktif';
            await updateDoc(doc(db, "chart_of_accounts", id), { status: newState, updated_at: serverTimestamp() });
            fetchData();
        } catch (e) { alert(e.message); }
    };

    const deleteAccount = async (id) => {
        if(confirm("Hapus akun ini?")) {
            await deleteDoc(doc(db, "chart_of_accounts", id));
            fetchData();
        }
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = ev.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);

                if (rows.length === 0) throw new Error("File kosong");
                if (!rows[0]['AccountID']) throw new Error("Format salah! Kolom harus: AccountID, Account Name, Account Type");
                if (!confirm(`Import ${rows.length} akun?`)) return;

                const batch = writeBatch(db);
                rows.forEach(row => {
                    const docRef = doc(db, "chart_of_accounts", String(row['AccountID']));
                    batch.set(docRef, {
                        code: String(row['AccountID']),
                        name: row['Account Name'],
                        category: row['Account Type'],
                        status: 'Aktif',
                        updated_at: serverTimestamp()
                    });
                });

                await batch.commit();
                alert("Import Berhasil!");
                fetchData();
            } catch (err) { alert("Gagal Import: " + err.message); }
            e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-display font-bold text-lumina-text tracking-tight">Chart of Accounts</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Master financial accounts (Assets, Liabilities, Equity).</p>
                </div>
                <label className="btn-ghost-dark cursor-pointer border-lumina-gold/50 text-lumina-gold hover:bg-lumina-gold/10 hover:border-lumina-gold">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    <span>Import CSV</span>
                    <input type="file" className="hidden" accept=".csv, .xlsx" onChange={handleImport} />
                </label>
            </div>

            {/* Table Card */}
            <div className="card-luxury overflow-hidden">
                <div className="table-wrapper-dark border-none shadow-none rounded-none">
                    <table className="table-dark">
                        <thead>
                            <tr>
                                <th className="pl-6 w-24">Code</th>
                                <th>Account Name</th>
                                <th>Category</th>
                                <th className="text-center">Status</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="5" className="text-center py-12 text-lumina-muted">Loading...</td></tr> : accounts.map(acc => {
                                let catColor = 'badge-neutral';
                                // Warna badge disesuaikan untuk dark mode (lebih terang/neon)
                                if (acc.category.includes('Aset')) catColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                if (acc.category.includes('Pendapatan')) catColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                if (acc.category.includes('Beban')) catColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                                if (acc.category.includes('Kewajiban') || acc.category.includes('Modal')) catColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                                return (
                                    <tr key={acc.id} className="group hover:bg-lumina-highlight/20 transition-colors">
                                        <td className="pl-6 font-mono font-bold text-lumina-gold text-sm">{acc.code}</td>
                                        <td className="font-medium text-lumina-text group-hover:text-white transition-colors">{acc.name}</td>
                                        <td><span className={`badge-luxury ${catColor}`}>{acc.category}</span></td>
                                        
                                        <td className="text-center">
                                            <button onClick={() => toggleStatus(acc.id, acc.status)} 
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-lumina-gold focus:ring-offset-1 focus:ring-offset-lumina-base ${acc.status === 'Aktif' ? 'bg-emerald-500' : 'bg-lumina-border'}`}
                                            >
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${acc.status === 'Aktif' ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                        </td>

                                        <td className="text-right pr-6">
                                            <button onClick={() => deleteAccount(acc.id)} className="text-xs font-bold text-lumina-muted hover:text-rose-500 transition-colors px-2 py-1 rounded hover:bg-rose-500/10">Del</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}