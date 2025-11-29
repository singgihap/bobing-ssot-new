"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Plus, Edit2, Trash2, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

const CACHE_KEY = 'lumina_categories_v2';
const CACHE_DURATION = 60 * 60 * 1000;

export default function CategoriesPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data: cachedData, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setData(cachedData);
                        setLoading(false);
                        return;
                    }
                }
            }
            const q = query(collection(db, "categories"), orderBy("name"), limit(100));
            const s = await getDocs(q);
            const d = []; 
            s.forEach(x => d.push({id:x.id, ...x.data()}));
            setData(d);
            if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, timestamp: Date.now() }));
        } catch(e) { console.error(e); toast.error("Gagal memuat kategori"); } finally { setLoading(false); }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        const savePromise = new Promise(async (resolve, reject) => {
            try { 
                if(formData.id) await updateDoc(doc(db,"categories",formData.id), formData); 
                else await addDoc(collection(db,"categories"), {...formData, created_at: serverTimestamp()});
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                setModalOpen(false); fetchData(true); resolve();
            } catch(e) { reject(e); }
        });
        toast.promise(savePromise, { loading: 'Menyimpan...', success: 'Kategori berhasil disimpan!', error: (err) => `Gagal: ${err.message}` });
    };

    const handleDelete = async (id) => {
        if(!confirm("Hapus kategori ini?")) return;
        try {
            await deleteDoc(doc(db, "categories", id));
            if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
            fetchData(true);
            toast.success("Kategori dihapus");
        } catch(e) { toast.error("Gagal menghapus"); }
    };

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            <PageHeader 
                title="Master Categories" 
                subtitle="Pengelompokan produk."
                actions={
                    <button onClick={() => { setFormData({ name:'' }); setModalOpen(true); }} className="btn-gold flex items-center gap-2 shadow-lg">
                        <Plus className="w-4 h-4 stroke-[3px]" /> Add Category
                    </button>
                }
            />

            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/80 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                            <tr><th className="pl-6 py-4">Category Name</th><th className="text-right pr-6 py-4">Actions</th></tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-border/60">
                            {loading ? <tr><td colSpan="2" className="text-center py-10 text-text-secondary animate-pulse">Loading...</td></tr> : 
                            data.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="pl-6 py-4 font-medium text-text-primary flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-primary"><Layers className="w-4 h-4"/></div>
                                        {c.name}
                                    </td>
                                    <td className="text-right pr-6 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={()=>{setFormData({...c}); setModalOpen(true)}} className="p-2 text-text-secondary hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                                            <button onClick={()=>handleDelete(c.id)} className="p-2 text-text-secondary hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Portal>
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                        <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                            <h3 className="text-lg font-bold text-text-primary mb-4">{formData.id ? 'Edit Category' : 'New Category'}</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">Nama Kategori</label>
                                    <input className="input-luxury" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} autoFocus placeholder="Contoh: Atasan" />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                    <button type="submit" className="btn-gold px-6">Save</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </Portal>
        </div>
    );
}