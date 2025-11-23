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
                    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Suppliers</h2>
                    <p className="text-sm text-gray-500 mt-1">Database of product suppliers.</p>
                </div>
                <button onClick={() => openModal()} className="btn-primary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    Add Supplier
                </button>
            </div>

            <div className="card p-0 overflow-hidden">
                <div className="table-wrapper border-0 shadow-none rounded-none">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th className="pl-6">Name</th>
                                <th>Contact</th>
                                <th>Address</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="4" className="text-center py-12 text-gray-400">Loading...</td></tr> : suppliers.map(s => (
                                <tr key={s.id}>
                                    <td className="pl-6 font-medium text-gray-900">{s.name}</td>
                                    <td className="font-mono text-gray-600 text-xs">{s.phone || '-'}</td>
                                    <td className="text-gray-500 truncate max-w-xs text-xs">{s.address || '-'}</td>
                                    <td className="text-right pr-6">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openModal(s)} className="text-xs font-bold text-brand-600 hover:text-brand-800 px-2 py-1 rounded hover:bg-brand-50">Edit</button>
                                            <button onClick={() => deleteItem(s.id)} className="text-xs font-bold text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50">Del</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 fade-in-up">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">{formData.id ? 'Edit Supplier' : 'New Supplier'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                    <input required className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="PT. Supplier" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone / WA</label>
                                    <input className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="08..." />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                                <textarea rows="2" className="input-field" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Complete address"></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                                <input className="input-field" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Additional info..." />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" className="btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}