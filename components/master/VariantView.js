// app/variants/page.js
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { sortBySize, formatRupiah } from '@/lib/utils';

export default function VariantsPage() {
    const [variants, setVariants] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBaseSku, setSelectedBaseSku] = useState('-');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [snapProd, snapVar] = await Promise.all([
                getDocs(query(collection(db, "products"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "product_variants"), orderBy("sku", "asc")))
            ]);
            const prodsData = []; snapProd.forEach(d => prodsData.push({id: d.id, ...d.data()}));
            setProducts(prodsData);
            const varsData = []; snapVar.forEach(d => varsData.push({id: d.id, ...d.data()}));
            setVariants(varsData);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleParentChange = (e) => {
        const pid = e.target.value;
        const prod = products.find(p => p.id === pid);
        setFormData({ ...formData, product_id: pid });
        setSelectedBaseSku(prod ? (prod.base_sku || 'No SKU') : '-');
    };

    const generateSku = () => {
        if (selectedBaseSku === '-' || !formData.color || !formData.size) return alert("Please select parent product, color and size first.");
        const colorClean = formData.color.trim().toUpperCase().replace(/\s+/g, '-');
        const sizeClean = formData.size.trim().toUpperCase().replace(/\s+/g, '-');
        const newSku = `${selectedBaseSku}-${colorClean}-${sizeClean}`;
        setFormData({ ...formData, sku: newSku, barcode: formData.barcode || newSku });
    };

    const openModal = (v = null) => {
        if (v) {
            const prod = products.find(p => p.id === v.product_id);
            setFormData({ ...v });
            setSelectedBaseSku(prod ? prod.base_sku : '-');
        } else {
            setFormData({ product_id: '', sku: '', barcode: '', color: '', size: '', weight: 0, cost: 0, price: 0, min_stock: 5, status: 'active' });
            setSelectedBaseSku('-');
        }
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, updated_at: serverTimestamp() };
            if (formData.id) await updateDoc(doc(db, "product_variants", formData.id), payload);
            else { payload.created_at = serverTimestamp(); await addDoc(collection(db, "product_variants"), payload); }
            setModalOpen(false); fetchData();
        } catch (err) { alert(err.message); }
    };

    const deleteVariant = async (id) => {
        if(confirm("Delete this SKU?")) { await deleteDoc(doc(db, "product_variants", id)); fetchData(); }
    };

    const filteredVariants = variants.filter(v => {
        const term = searchTerm.toLowerCase();
        const pName = products.find(p => p.id === v.product_id)?.name.toLowerCase() || '';
        return v.sku.toLowerCase().includes(term) || pName.includes(term);
    }).sort(sortBySize);

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Variants (SKU)</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage individual stock keeping units.</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input 
                            type="text" 
                            placeholder="Search SKU..." 
                            className="w-full pl-10 pr-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-100 focus:border-brand-500 outline-none shadow-sm"
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <button onClick={() => openModal()} className="btn-primary whitespace-nowrap">
                        Add SKU
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                <div className="table-wrapper border-0 shadow-none rounded-none">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th className="pl-6">SKU Final</th>
                                <th>Parent Product</th>
                                <th>Variant Spec</th>
                                <th className="text-right">HPP</th>
                                <th className="text-right">Price</th>
                                <th className="text-center">Status</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="7" className="text-center py-12 text-gray-400">Loading...</td></tr> : filteredVariants.map(v => {
                                const parent = products.find(p => p.id === v.product_id);
                                return (
                                    <tr key={v.id} className="group">
                                        <td className="pl-6 font-mono text-xs font-bold text-brand-600 bg-brand-50/30 w-fit rounded-r">{v.sku}</td>
                                        <td className="font-medium text-gray-700">{parent?.name || '-'}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <span className="badge badge-neutral">{v.color}</span>
                                                <span className="badge badge-neutral">{v.size}</span>
                                            </div>
                                        </td>
                                        <td className="text-right text-gray-500 text-xs">{formatRupiah(v.cost)}</td>
                                        <td className="text-right font-semibold text-gray-900 text-xs">{formatRupiah(v.price)}</td>
                                        <td className="text-center">
                                            <span className={`badge ${v.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{v.status}</span>
                                        </td>
                                        <td className="text-right pr-6">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(v)} className="text-xs font-bold text-brand-600 hover:text-brand-800 px-2 py-1 rounded hover:bg-brand-50">Edit</button>
                                                <button onClick={() => deleteVariant(v.id)} className="text-xs font-bold text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50">Del</button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-2xl w-full p-6 fade-in-up overflow-y-auto max-h-[90vh]">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">{formData.id ? 'Edit SKU' : 'New SKU'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            
                            <div className="bg-brand-25 p-4 rounded-xl border border-brand-100">
                                <label className="block text-xs font-bold text-brand-800 uppercase mb-1">Parent Product</label>
                                <select required className="select-field bg-white" value={formData.product_id} onChange={handleParentChange}>
                                    <option value="">-- Select Model --</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.base_sku})</option>)}
                                </select>
                                <div className="text-xs text-brand-600 mt-2 font-mono flex items-center gap-2">
                                    Base SKU: <span className="font-bold bg-white px-2 py-0.5 rounded border border-brand-200">{selectedBaseSku}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-xs font-medium text-gray-700 mb-1">Color</label><input className="input-field" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} placeholder="Black" /></div>
                                <div><label className="block text-xs font-medium text-gray-700 mb-1">Size</label><input className="input-field" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} placeholder="XL" /></div>
                                <div><label className="block text-xs font-medium text-gray-700 mb-1">Weight (g)</label><input type="number" className="input-field" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Final SKU</label>
                                    <div className="flex gap-2">
                                        <input required className="input-field font-mono uppercase bg-white" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                                        <button type="button" onClick={generateSku} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50">Auto</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Barcode</label>
                                    <input className="input-field bg-white" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Scan..." />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-xs font-medium text-gray-700 mb-1">HPP (Cost)</label><input type="number" required className="input-field" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-brand-600 mb-1">Sell Price</label><input type="number" required className="input-field font-bold text-brand-700 bg-brand-50/30" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                    <select className="select-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">Min. Stock</label>
                                <input 
                                    type="number" 
                                    className="w-full border p-2 rounded" 
                                    value={formData.min_stock || 0} 
                                    onChange={e => setFormData({...formData, min_stock: e.target.value})} 
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" className="btn-primary">Save SKU</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}