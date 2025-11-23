// app/brands/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

export default function BrandsPage() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const q = query(collection(db, "brands"), orderBy("name", "asc"));
            const snap = await getDocs(q);
            const data = [];
            snap.forEach(d => data.push({id: d.id, ...d.data()}));
            setBrands(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const openModal = (brand = null) => {
        setFormData(brand ? { ...brand } : { name: '', type: 'own_brand' });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { name: formData.name, type: formData.type, updated_at: serverTimestamp() };
            if (formData.id) await updateDoc(doc(db, "brands", formData.id), payload);
            else { payload.created_at = serverTimestamp(); await addDoc(collection(db, "brands"), payload); }
            setModalOpen(false); fetchData();
        } catch (e) { alert(e.message); }
    };

    const deleteBrand = async (id) => {
        if(confirm("Delete brand?")) { await deleteDoc(doc(db, "brands", id)); fetchData(); }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Master Brands</h2>
                    <p className="text-sm text-gray-500">Manage your own brands and supplier brands.</p>
                </div>
                <button onClick={() => openModal()} className="btn-primary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    Add Brand
                </button>
            </div>

            <div className="card p-0 overflow-hidden">
                <div className="table-wrapper">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Brand Name</th>
                                <th>Type</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="3" className="text-center py-8 text-gray-400">Loading...</td></tr> : brands.map(b => (
                                <tr key={b.id}>
                                    <td className="font-semibold text-gray-900">{b.name}</td>
                                    <td>
                                        {b.type === 'own_brand' 
                                            ? <span className="badge badge-brand">Own Brand</span>
                                            : <span className="badge badge-warning">Supplier</span>
                                        }
                                    </td>
                                    <td className="text-right space-x-2">
                                        <button onClick={() => openModal(b)} className="text-xs font-bold text-brand-600 hover:text-brand-800">Edit</button>
                                        <button onClick={() => deleteBrand(b.id)} className="text-xs font-bold text-red-600 hover:text-red-800">Del</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 fade-in-up">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">{formData.id ? 'Edit Brand' : 'New Brand'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Brand Name</label>
                                <input type="text" required className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Al Muslim" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Type</label>
                                <select className="select-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                    <option value="own_brand">Own Brand (Internal)</option>
                                    <option value="supplier_brand">Supplier Brand</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save Brand</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}