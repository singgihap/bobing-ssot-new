"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { sortBySize, formatRupiah } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';

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
            const [snapProd, snapVar] = await Promise.all([getDocs(query(collection(db, "products"), orderBy("name"))), getDocs(query(collection(db, "product_variants"), orderBy("sku")))]);
            const ps = []; snapProd.forEach(d => ps.push({id:d.id, ...d.data()})); setProducts(ps);
            const vs = []; snapVar.forEach(d => vs.push({id:d.id, ...d.data()})); setVariants(vs);
        } catch(e){console.error(e)} finally {setLoading(false)}
    };
    
    const handleParentChange = (e) => { const p = products.find(x=>x.id===e.target.value); setFormData({...formData, product_id: e.target.value}); setSelectedBaseSku(p?p.base_sku:'-'); };
    const generateSku = () => {
        const c = formData.color?.toUpperCase().replace(/\s/g,'-'); const s = formData.size?.toUpperCase().replace(/\s/g,'-');
        if(selectedBaseSku!=='-' && c && s) setFormData({...formData, sku: `${selectedBaseSku}-${c}-${s}`});
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const pl = {...formData, updated_at: serverTimestamp(), weight: Number(formData.weight)||0, cost: Number(formData.cost), price: Number(formData.price)};
            if(formData.id) await updateDoc(doc(db,"product_variants",formData.id), pl); else { pl.created_at=serverTimestamp(); await addDoc(collection(db,"product_variants"), pl); }
            setModalOpen(false); fetchData();
        } catch(e){alert(e.message)}
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-lumina-text">Master SKU</h2>
                <button onClick={()=>{setFormData({product_id:'',sku:'',color:'',size:'',cost:0,price:0,status:'active'}); setModalOpen(true);}} className="btn-gold">Add SKU</button>
            </div>
            <div className="bg-lumina-surface border border-lumina-border p-2 rounded-xl shadow-lg max-w-md"><input className="w-full bg-transparent text-lumina-text px-3 py-1 outline-none" placeholder="Search SKU..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} /></div>

            <div className="card-luxury overflow-hidden">
                <table className="table-dark w-full">
                    <thead><tr><th className="pl-6">SKU</th><th>Parent</th><th>Spec</th><th className="text-right">Price</th><th className="text-right pr-6">Action</th></tr></thead>
                    <tbody>
                        {variants.filter(v=>v.sku.includes(searchTerm.toUpperCase())).map(v=>(
                            <tr key={v.id} className="hover:bg-lumina-highlight/20">
                                <td className="pl-6 py-3 font-mono text-lumina-gold font-bold">{v.sku}</td>
                                <td className="text-lumina-text">{products.find(p=>p.id===v.product_id)?.name}</td>
                                <td><span className="badge-luxury badge-neutral">{v.color}/{v.size}</span></td>
                                <td className="text-right font-bold text-white">{formatRupiah(v.price)}</td>
                                <td className="text-right pr-6"><button onClick={()=>{setFormData({...v}); setModalOpen(true);}} className="text-xs font-bold text-lumina-muted hover:text-white">Edit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- CENTERED MODAL --- */}
            <Portal>
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-lumina-surface border border-lumina-border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-lumina-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">{formData.id?'Edit SKU':'New SKU'}</h3>
                            <button onClick={()=>setModalOpen(false)} className="text-lumina-muted hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            <div className="bg-lumina-base p-4 rounded-xl border border-lumina-border">
                                <label className="text-xs font-bold text-lumina-muted uppercase">Parent Product</label>
                                <select className="input-luxury mt-1" value={formData.product_id} onChange={handleParentChange}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                <div className="text-xs text-lumina-gold mt-2 font-mono">Base: {selectedBaseSku}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="text-xs font-bold text-lumina-muted">Color</label><input className="input-luxury mt-1" value={formData.color} onChange={e=>setFormData({...formData, color:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-lumina-muted">Size</label><input className="input-luxury mt-1" value={formData.size} onChange={e=>setFormData({...formData, size:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-lumina-muted">Weight (g)</label><input type="number" className="input-luxury mt-1" value={formData.weight} onChange={e=>setFormData({...formData, weight:e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-lumina-muted">SKU Final</label><div className="flex gap-2 mt-1"><input className="input-luxury font-mono" value={formData.sku} onChange={e=>setFormData({...formData, sku:e.target.value})} /><button onClick={generateSku} className="btn-ghost-dark px-3 py-2">Auto</button></div></div>
                                <div><label className="text-xs font-bold text-lumina-muted">Barcode</label><input className="input-luxury mt-1" value={formData.barcode} onChange={e=>setFormData({...formData, barcode:e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-lumina-muted">HPP</label><input type="number" className="input-luxury mt-1" value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-lumina-gold">Sell Price</label><input type="number" className="input-luxury mt-1 border-lumina-gold" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})}/></div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-lumina-border bg-lumina-base rounded-b-2xl flex justify-end gap-3">
                            <button onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                            <button onClick={handleSubmit} className="btn-gold">Save SKU</button>
                        </div>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}