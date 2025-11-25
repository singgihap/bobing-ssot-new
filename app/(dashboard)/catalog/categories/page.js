"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
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
            // 1. Cek Cache LocalStorage
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

            // 2. Fetch Data dari Firebase
            const q = query(collection(db, "categories"), orderBy("name"), limit(100));
            const s = await getDocs(q);
            const d = []; 
            s.forEach(x => d.push({id:x.id, ...x.data()}));
            
            setData(d);
            
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, timestamp: Date.now() }));
            }

        } catch(e) {
            console.error(e);
            toast.error("Gagal memuat kategori");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        const savePromise = new Promise(async (resolve, reject) => {
            try { 
                if(formData.id) {
                    await updateDoc(doc(db,"categories",formData.id), formData); 
                } else {
                    await addDoc(collection(db,"categories"), {...formData, created_at: serverTimestamp()});
                }
                
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                setModalOpen(false); 
                fetchData(true); 
                resolve();
            } catch(e) { reject(e); }
        });
        toast.promise(savePromise, { loading: 'Menyimpan...', success: 'Kategori berhasil disimpan!', error: (err) => `Gagal: ${err.message}` });
    };

    const handleDelete = async (id) => {
        if(!confirm("Hapus kategori ini?")) return;
        const deletePromise = new Promise(async (resolve, reject) => {
            try {
                await deleteDoc(doc(db, "categories", id));
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                fetchData(true);
                resolve();
            } catch(e) { reject(e); }
        });
        toast.promise(deletePromise, { loading: 'Menghapus...', success: 'Kategori dihapus', error: (err) => `Gagal: ${err.message}` });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl md:text-3xl font-bold text-lumina-text">Categories</h2>
                <button onClick={() => { setFormData({ name:'' }); setModalOpen(true); }} className="btn-gold w-full sm:w-auto">
                    Add Category
                </button>
            </div>

            <div className="card-luxury overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-dark w-full min-w-[300px]">
                        <thead>
                            <tr>
                                <th className="pl-6">Category Name</th>
                                <th className="text-right pr-6">Act</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="2" className="text-center py-4 text-lumina-muted">Loading...</td></tr>
                            ) : data.map(c => (
                                <tr key={c.id}>
                                    <td className="pl-6 text-white font-medium">{c.name}</td>
                                    <td className="text-right pr-6 flex justify-end gap-3 py-3">
                                        <button onClick={()=>{setFormData({...c}); setModalOpen(true)}} className="text-xs font-bold text-lumina-muted hover:text-white transition-colors">Edit</button>
                                        <button onClick={()=>handleDelete(c.id)} className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors">Del</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Portal>
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 fade-in">
                        <div className="bg-lumina-surface border border-lumina-border rounded-2xl p-6 w-full max-w-sm shadow-2xl ring-1 ring-lumina-gold/20">
                            <h3 className="text-lg font-bold text-white mb-4">{formData.id ? 'Edit Category' : 'New Category'}</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <input 
                                    className="input-luxury" 
                                    placeholder="Category Name" 
                                    value={formData.name} 
                                    onChange={e=>setFormData({...formData,name:e.target.value})}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                    <button type="submit" className="btn-gold">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </Portal>
        </div>
    );
}