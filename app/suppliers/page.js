// app/suppliers/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const q = query(collection(db, "suppliers"), orderBy("name", "asc"));
            const snap = await getDocs(q);
            const data = [];
            snap.forEach(d => data.push({id: d.id, ...d.data()}));
            setSuppliers(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const openModal = (sup = null) => {
        setFormData(sup ? { ...sup } : { name: '', phone: '', address: '', notes: '' });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                address: formData.address,
                notes: formData.notes,
                updated_at: serverTimestamp()
            };
            if (formData.id) await updateDoc(doc(db, "suppliers", formData.id), payload);
            else { payload.created_at = serverTimestamp(); await addDoc(collection(db, "suppliers"), payload); }
            setModalOpen(false); fetchData();
        } catch (e) { alert("Gagal: " + e.message); }
    };

    const deleteItem = async (id) => {
        if(confirm("Hapus supplier ini?")) { await deleteDoc(doc(db, "suppliers", id)); fetchData(); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-display font-bold text-lumina-text tracking-tight">Suppliers</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Database of product suppliers.</p>
                </div>
                <button onClick={() => openModal()} className="btn-gold">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    Add Supplier
                </button>
            </div>

            <div className="card-luxury overflow-hidden">
                <div className="table-wrapper-dark border-none shadow-none rounded-none">
                    <table className="table-dark">
                        <thead>
                            <tr>
                                <th className="pl-6">Name</th>
                                <th>Contact</th>
                                <th>Address</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="4" className="text-center py-12 text-lumina-muted">Loading...</td></tr> : suppliers.map(s => (
                                <tr key={s.id}>
                                    <td className="pl-6 font-medium text-lumina-text">{s.name}</td>
                                    <td className="font-mono text-lumina-muted text-xs">{s.phone || '-'}</td>
                                    <td className="text-lumina-muted truncate max-w-xs text-xs">{s.address || '-'}</td>
                                    <td className="text-right pr-6">
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => openModal(s)} className="text-xs font-bold text-lumina-muted hover:text-white transition-colors">Edit</button>
                                            <button onClick={() => deleteItem(s.id)} className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors">Del</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-lg w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-white">{formData.id ? 'Edit Supplier' : 'New Supplier'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-lumina-muted hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Name</label>
                                    <input required className="input-luxury" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="PT. Supplier" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Phone / WA</label>
                                    <input className="input-luxury" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="08..." />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Address</label>
                                <textarea rows="2" className="input-luxury" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Complete address"></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Notes</label>
                                <input className="input-luxury" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Additional info..." />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-lumina-border">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                <button type="submit" className="btn-gold">Save Supplier</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}