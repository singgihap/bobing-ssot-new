// app/warehouses/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [snapSupp, snapWh] = await Promise.all([
                getDocs(query(collection(db, "suppliers"), orderBy("name"))),
                getDocs(query(collection(db, "warehouses"), orderBy("created_at")))
            ]);
            
            const suppData = []; snapSupp.forEach(d => suppData.push({id: d.id, ...d.data()}));
            setSuppliers(suppData);

            const whData = []; snapWh.forEach(d => whData.push({id: d.id, ...d.data()}));
            setWarehouses(whData);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const openModal = (wh = null) => {
        setFormData(wh ? { ...wh } : { name: '', type: 'physical', supplier_id: '', address: '' });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                type: formData.type,
                address: formData.address,
                supplier_id: formData.type === 'virtual_supplier' ? formData.supplier_id : null,
                updated_at: serverTimestamp()
            };
            if (formData.id) await updateDoc(doc(db, "warehouses", formData.id), payload);
            else { payload.created_at = serverTimestamp(); await addDoc(collection(db, "warehouses"), payload); }
            setModalOpen(false); fetchData();
        } catch (err) { alert(err.message); }
    };

    const deleteWh = async (id) => {
        if(confirm("Hapus gudang?")) { await deleteDoc(doc(db, "warehouses", id)); fetchData(); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-lumina-text font-display">Warehouses</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Manage physical locations and virtual supplier stocks.</p>
                </div>
                <button onClick={() => openModal()} className="btn-gold">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    New Warehouse
                </button>
            </div>

            {/* Grid Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <div className="col-span-full text-center py-12 text-lumina-muted">Loading...</div> : warehouses.map(w => {
                    const isVirtual = w.type === 'virtual_supplier';
                    const supName = isVirtual ? (suppliers.find(s => s.id === w.supplier_id)?.name || 'Unknown') : '-';
                    
                    return (
                        <div key={w.id} className="card-luxury p-6 flex flex-col justify-between h-full group hover:border-lumina-gold/50 transition-all">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${isVirtual ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                        {isVirtual 
                                            ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
                                            : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                                        }
                                    </div>
                                    <span className={`badge-luxury ${isVirtual ? 'badge-neutral' : 'badge-success'}`}>
                                        {isVirtual ? 'Virtual' : 'Physical'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-lumina-text mb-1 group-hover:text-lumina-gold transition-colors">{w.name}</h3>
                                <p className="text-xs text-lumina-muted font-mono mb-4">{w.id.substring(0,8)}...</p>
                                
                                {isVirtual && (
                                    <div className="mb-4 text-xs font-medium text-indigo-300 bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-500/20 flex items-center gap-2">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                        Supplier: {supName}
                                    </div>
                                )}
                                <p className="text-sm text-lumina-muted mb-4 line-clamp-2">{w.address || 'No address provided.'}</p>
                            </div>

                            <div className="pt-4 border-t border-lumina-border flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openModal(w)} className="text-xs font-bold text-lumina-muted hover:text-white transition-colors">EDIT</button>
                                <button onClick={() => deleteWh(w.id)} className="text-xs font-bold text-lumina-muted hover:text-rose-500 transition-colors">DELETE</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            <Portal>
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl max-w-lg w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-lumina-text">{formData.id ? 'Edit Warehouse' : 'New Warehouse'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-lumina-muted hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Warehouse Name</label>
                                <input required className="input-luxury" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Gudang Utama" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Type</label>
                                <select className="input-luxury" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                    <option value="physical">🏠 Physical (Inventory)</option>
                                    <option value="virtual_supplier">☁️ Virtual (Supplier Stock)</option>
                                </select>
                            </div>
                            {formData.type === 'virtual_supplier' && (
                                <div className="bg-lumina-base p-4 rounded-xl border border-lumina-border">
                                    <label className="block text-xs font-bold text-lumina-gold mb-1 uppercase">Link to Supplier</label>
                                    <select className="input-luxury bg-lumina-highlight" value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                                        <option value="">-- Select Supplier --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-lumina-muted uppercase mb-1">Address</label>
                                <textarea rows="3" className="input-luxury" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Location address..."></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-lumina-border">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                <button type="submit" className="btn-gold">Save Warehouse</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}