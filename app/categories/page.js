"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';

export default function CategoriesPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => { fetchData(); }, []);
    const fetchData = async () => { try { const s = await getDocs(query(collection(db, "categories"), orderBy("name"))); const d=[]; s.forEach(x=>d.push({id:x.id,...x.data()})); setData(d); } catch(e){} finally{setLoading(false)} };
    const handleSubmit = async (e) => { e.preventDefault(); try { if(formData.id) await updateDoc(doc(db,"categories",formData.id), formData); else await addDoc(collection(db,"categories"), {...formData, created_at: serverTimestamp()}); setModalOpen(false); fetchData(); } catch(e){alert(e.message)} };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-lumina-text">Categories</h2><button onClick={()=>{setFormData({name:''}); setModalOpen(true)}} className="btn-gold">Add Category</button></div>
            <div className="card-luxury overflow-hidden"><table className="table-dark w-full"><thead><tr><th className="pl-6">Category Name</th><th className="text-right pr-6">Act</th></tr></thead><tbody>{data.map(c=><tr key={c.id}><td className="pl-6 text-white font-medium">{c.name}</td><td className="text-right pr-6"><button onClick={()=>{setFormData({...c}); setModalOpen(true)}} className="text-xs text-lumina-gold">Edit</button></td></tr>)}</tbody></table></div>
            <Portal>
                {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="bg-lumina-surface border border-lumina-border rounded-2xl p-6 w-full max-w-sm"><h3 className="text-lg font-bold text-white mb-4">Category Form</h3><form onSubmit={handleSubmit} className="space-y-4"><input className="input-luxury" placeholder="Category Name" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})}/><div className="flex justify-end gap-2"><button type="button" onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button><button className="btn-gold">Save</button></div></form></div></div>}
            </Portal>
        </div>
    );
}