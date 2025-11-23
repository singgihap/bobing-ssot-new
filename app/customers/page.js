// app/customers/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [scanning, setScanning] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const q = query(collection(db, "customers"), orderBy("name", "asc"));
            const snap = await getDocs(q);
            const data = [];
            snap.forEach(d => data.push({id: d.id, ...d.data()}));
            setCustomers(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const scanFromSales = async () => {
        if(!confirm("Scan riwayat penjualan untuk data pelanggan baru?")) return;
        setScanning(true);
        try {
            const snapSales = await getDocs(collection(db, "sales_orders"));
            const newCandidates = {};
            snapSales.forEach(doc => {
                const s = doc.data();
                const name = s.customer_name || '';
                const phone = s.customer_phone || '';
                if (phone.length > 9 && !phone.includes('*') && !name.includes('*')) {
                    if (!newCandidates[phone]) {
                        newCandidates[phone] = { name, phone, address: s.shipping_address || '', type: 'end_customer' };
                    }
                }
            });

            const existingPhones = new Set(customers.map(c => c.phone));
            const finalToAdd = Object.values(newCandidates).filter(c => !existingPhones.has(c.phone));

            if (finalToAdd.length === 0) {
                alert("Scan selesai. Tidak ditemukan data baru.");
            } else {
                const batch = writeBatch(db);
                finalToAdd.forEach(c => {
                    const ref = doc(collection(db, "customers"));
                    batch.set(ref, { ...c, created_at: serverTimestamp(), source: 'auto_scan' });
                });
                await batch.commit();
                alert(`Berhasil menyimpan ${finalToAdd.length} pelanggan baru!`);
                fetchData();
            }
        } catch (e) { alert(e.message); } finally { setScanning(false); }
    };

    const openModal = (cust = null) => {
        setFormData(cust ? { ...cust } : { name: '', type: 'end_customer', phone: '', address: '' });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                type: formData.type,
                phone: formData.phone,
                address: formData.address,
                updated_at: serverTimestamp()
            };
            if (formData.id) await updateDoc(doc(db, "customers", formData.id), payload);
            else { payload.created_at = serverTimestamp(); await addDoc(collection(db, "customers"), payload); }
            setModalOpen(false); fetchData();
        } catch (e) { alert(e.message); }
    };

    const deleteItem = async (id) => {
        if(confirm("Hapus pelanggan?")) { await deleteDoc(doc(db, "customers", id)); fetchData(); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-lumina-text font-display">Customers</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">CRM database for resellers and loyal customers.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={scanFromSales} disabled={scanning} className="btn-ghost-dark text-xs">
                        {scanning ? 'Scanning...' : 'Scan Sales'}
                    </button>
                    <button onClick={() => openModal()} className="btn-gold">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        New Customer
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="card-luxury overflow-hidden">
                <div className="table-wrapper-dark border-none shadow-none rounded-none">
                    <table className="table-dark">
                        <thead>
                            <tr>
                                <th className="pl-6">Name</th>
                                <th>Type</th>
                                <th>Phone</th>
                                <th>Location</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="5" className="text-center py-12 text-lumina-muted">Loading...</td></tr> : customers.map(c => {
                                let badgeClass = 'badge-neutral';
                                if(c.type === 'reseller') badgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                                if(c.type === 'vip') badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                                
                                return (
                                    <tr key={c.id}>
                                        <td className="pl-6 font-medium text-lumina-text">{c.name}</td>
                                        <td><span className={`badge-luxury ${badgeClass}`}>{c.type?.replace('_', ' ')}</span></td>
                                        <td className="font-mono text-lumina-muted text-xs">{c.phone || '-'}</td>
                                        <td className="text-lumina-muted truncate max-w-xs text-xs">{c.address || '-'}</td>
                                        <td className="text-right pr-6">
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => openModal(c)} className="text-xs font-bold text-lumina-muted hover:text-white transition-colors">Edit</button>
                                                <button onClick={() => deleteItem(c.id)} className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors">Del</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-lg w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-white">{formData.id ? 'Edit Customer' : 'New Customer'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-lumina-muted hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Name</label>
                                    <input required className="input-luxury" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Type</label>
                                    <select className="input-luxury" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                        <option value="end_customer">Customer Umum</option>
                                        <option value="reseller">Reseller / Agen</option>
                                        <option value="vip">VIP</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Phone / WA</label>
                                <input className="input-luxury" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="08..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Address</label>
                                <textarea rows="3" className="input-luxury" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Complete address..."></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-lumina-border">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                <button type="submit" className="btn-gold">Save Customer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}