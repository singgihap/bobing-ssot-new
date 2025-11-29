"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { motion } from 'framer-motion';

const CACHE_KEY = 'lumina_brands_v2';
const CACHE_KEY_PRODUCTS = 'lumina_products_data_v2';
const CACHE_DURATION = 60 * 60 * 1000;

export default function BrandsPage() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            let data = null;
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < CACHE_DURATION) data = parsed.data;
                }
            }
            if (!data) {
                const q = query(collection(db, "brands"), orderBy("name"), limit(100));
                const s = await getDocs(q);
                data = []; s.forEach(x => data.push({id:x.id, ...x.data()}));
                if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, timestamp: Date.now() }));
            }
            setBrands(data || []);
        } catch(e) { console.error(e); toast.error("Gagal memuat brands"); } finally { setLoading(false); }
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        const savePromise = new Promise(async (resolve, reject) => {
            try { 
                if(formData.id) await updateDoc(doc(db,"brands",formData.id), formData);
                else await addDoc(collection(db,"brands"), {...formData, created_at: serverTimestamp()}); 
                if (typeof window !== 'undefined') { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_KEY_PRODUCTS); }
                setModalOpen(false); fetchData(true); resolve();
            } catch(e) { reject(e); } 
        });
        toast.promise(savePromise, { loading: 'Menyimpan...', success: 'Brand berhasil disimpan!', error: (err) => `Gagal: ${err.message}` });
    };

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            <PageHeader 
                title="Master Brands" 
                subtitle="Daftar merek produk."
                actions={
                    <button onClick={() => { setFormData({ name:'', type:'own_brand' }); setModalOpen(true); }} className="btn-gold flex items-center gap-2 shadow-lg">
                        <Plus className="w-4 h-4 stroke-[3px]" /> Add Brand
                    </button>
                }
            />
            
            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/80 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                            <tr><th className="pl-6 py-4">Brand Name</th><th className="py-4">Type</th><th className="text-right pr-6 py-4">Actions</th></tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-border/60">
                            {loading ? <tr><td colSpan="3" className="text-center py-10 text-text-secondary animate-pulse">Loading...</td></tr> : 
                            brands.map(b => (
                                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="pl-6 py-4 font-medium text-text-primary flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-accent"><Tag className="w-4 h-4"/></div>
                                        {b.name}
                                    </td>
                                    <td className="py-4"><span className="text-[10px] bg-gray-100 text-text-secondary px-2 py-1 rounded border border-border uppercase font-bold">{b.type?.replace('_',' ')}</span></td>
                                    <td className="text-right pr-6 py-4">
                                        <button onClick={()=>{setFormData({...b}); setModalOpen(true)}} className="p-2 text-text-secondary hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
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
                            <h3 className="text-lg font-bold text-text-primary mb-4">Brand Form</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">Nama Brand</label>
                                    <input className="input-luxury" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} placeholder="Nama Brand" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-secondary block mb-1">Tipe</label>
                                    <select className="input-luxury" value={formData.type} onChange={e=>setFormData({...formData,type:e.target.value})}>
                                        <option value="own_brand">Own Brand</option>
                                        <option value="supplier_brand">Supplier</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                    <button className="btn-gold px-6">Save</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </Portal>
        </div>
    );
}