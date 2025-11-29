"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch, limit } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

// --- MODERN UI IMPORTS ---
import { 
    Users, Plus, Search, Trash2, Edit2, ScanLine, X, 
    Phone, MapPin, User, CheckCircle, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- KONFIGURASI CACHE ---
const CACHE_KEY = 'lumina_customers_v2';
const CACHE_DURATION = 30 * 60 * 1000; // 30 Menit

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [scanning, setScanning] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { fetchData(); }, []);

    // 1. Fetch Data
    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // A. Cek Cache LocalStorage
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        setCustomers(data);
                        setLoading(false);
                        return;
                    }
                }
            }

            // B. Fetch Firebase
            const q = query(collection(db, "customers"), orderBy("name", "asc"), limit(100));
            const snap = await getDocs(q);
            const data = [];
            snap.forEach(d => data.push({id: d.id, ...d.data()}));
            
            setCustomers(data);
            
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
            }

        } catch (e) { 
            console.error(e); 
            toast.error("Gagal memuat customers");
        } finally { 
            setLoading(false); 
        }
    };

    // 2. Scan Logic
    const scanFromSales = async () => {
        if(!confirm("Scan 500 transaksi terakhir untuk pelanggan baru?")) return;
        setScanning(true);
        const scanPromise = new Promise(async (resolve, reject) => {
            try {
                const qSales = query(collection(db, "sales_orders"), orderBy("order_date", "desc"), limit(500));
                const snapSales = await getDocs(qSales);
                const newCandidates = {};
                
                snapSales.forEach(doc => {
                    const s = doc.data();
                    const name = s.customer_name || s.buyer_name || '';
                    const phone = s.customer_phone || s.buyer_phone || ''; 
                    
                    if (name && !name.toLowerCase().includes('guest') && !name.includes('*')) {
                        const key = phone.length > 5 ? phone : name.toLowerCase();
                        if (!newCandidates[key]) {
                            newCandidates[key] = { 
                                name, 
                                phone, 
                                address: s.shipping_address || s.buyer_address || '', 
                                type: 'end_customer' 
                            };
                        }
                    }
                });

                const existingNames = new Set(customers.map(c => c.name.toLowerCase()));
                const existingPhones = new Set(customers.map(c => c.phone));

                const finalToAdd = Object.values(newCandidates).filter(c => {
                    const hasPhone = c.phone && existingPhones.has(c.phone);
                    const hasName = existingNames.has(c.name.toLowerCase());
                    return !hasPhone && !hasName;
                });

                if (finalToAdd.length === 0) {
                    resolve("Tidak ditemukan pelanggan baru.");
                } else {
                    const batch = writeBatch(db);
                    const batchList = finalToAdd.slice(0, 400);
                    
                    batchList.forEach(c => {
                        const ref = doc(collection(db, "customers"));
                        batch.set(ref, { ...c, created_at: serverTimestamp(), source: 'auto_scan' });
                    });
                    
                    await batch.commit();
                    if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                    fetchData(true);
                    
                    resolve(`Berhasil menyimpan ${batchList.length} pelanggan baru!`);
                }
            } catch (e) { reject(e); } finally { setScanning(false); }
        });

        toast.promise(scanPromise, {
            loading: 'Scanning sales history...',
            success: (msg) => msg,
            error: (err) => `Gagal: ${err.message}`,
        });
    };

    // 3. Actions
    const openModal = (cust = null) => {
        setFormData(cust ? { ...cust } : { name: '', type: 'end_customer', phone: '', address: '' });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const savePromise = new Promise(async (resolve, reject) => {
            try {
                const payload = {
                    name: formData.name,
                    type: formData.type,
                    phone: formData.phone,
                    address: formData.address,
                    updated_at: serverTimestamp()
                };
                
                if (formData.id) {
                    await updateDoc(doc(db, "customers", formData.id), payload);
                } else { 
                    payload.created_at = serverTimestamp(); 
                    await addDoc(collection(db, "customers"), payload); 
                }
                
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                setModalOpen(false); 
                fetchData(true);
                resolve();
            } catch (e) { reject(e); }
        });

        toast.promise(savePromise, {
            loading: 'Menyimpan...',
            success: 'Data berhasil disimpan',
            error: (err) => `Gagal: ${err.message}`
        });
    };

    const deleteItem = async (id) => {
        if(confirm("Hapus pelanggan?")) { 
            try {
                await deleteDoc(doc(db, "customers", id)); 
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                fetchData(true);
                toast.success("Pelanggan dihapus");
            } catch(e) {
                toast.error("Gagal menghapus");
            }
        }
    };

    // Filter Logic Client Side
    const filteredData = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone && c.phone.includes(searchTerm))
    );

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            
            <PageHeader 
                title="Customers CRM" 
                subtitle="Database pelanggan, reseller, dan kontak VIP."
                actions={
                    <div className="flex gap-3">
                        <button 
                            onClick={scanFromSales} 
                            disabled={scanning} 
                            className="btn-ghost-dark text-xs flex items-center gap-2 border-border bg-white shadow-sm"
                        >
                            <ScanLine className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                            {scanning ? 'Scanning...' : 'Scan Sales'}
                        </button>
                       <button
                            onClick={() => openModal()}
                            className="btn-gold inline-flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-lg hover:shadow-xl"
                            >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>New Customer</span>
                        </button>
                    </div>
                }
            />

            {/* SEARCH & FILTERS */}
            <div className="relative max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Cari nama atau nomor HP..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input-luxury pl-10 py-2.5"
                />
            </div>

            {/* TABLE CARD */}
            <div className="card-luxury overflow-hidden border border-border">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="table-modern w-full">
                        <thead>
                            <tr>
                                <th className="pl-6 w-1/3">Name & Type</th>
                                <th>Contact Info</th>
                                <th>Location</th>
                                <th className="text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {loading ? (
                                <tr><td colSpan="4" className="text-center py-20 text-text-secondary animate-pulse">Loading Customers...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-20 text-text-secondary">Tidak ada data ditemukan.</td></tr>
                            ) : (
                                filteredData.map(c => (
                                    <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="pl-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-text-primary text-sm">{c.name}</div>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide border ${
                                                        c.type === 'vip' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        c.type === 'reseller' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                                        'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                        {c.type?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                                                <Phone className="w-3.5 h-3.5" />
                                                <span className="font-mono">{c.phone || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-start gap-2 text-sm text-text-secondary max-w-xs">
                                                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                <span className="truncate">{c.address || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="pr-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(c)} className="p-2 bg-white border border-border rounded-lg text-text-secondary hover:text-primary hover:border-primary shadow-sm transition-all">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => deleteItem(c.id)} className="p-2 bg-white border border-border rounded-lg text-rose-400 hover:text-rose-600 hover:border-rose-200 shadow-sm transition-all">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            <Portal>
                <AnimatePresence>
                    {modalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                            >
                                <div className="px-6 py-5 border-b border-border bg-gray-50 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary">{formData.id ? 'Edit Customer' : 'New Customer'}</h3>
                                        <p className="text-xs text-text-secondary mt-0.5">Manage details and classification.</p>
                                    </div>
                                    <button onClick={() => setModalOpen(false)} className="bg-white p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
                                    <div className="space-y-4">
                                        <div className="group">
                                            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Nama Lengkap</label>
                                            <div className="relative">
                                                <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                                                <input required className="input-luxury pl-10" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nama Pelanggan" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="group">
                                                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Tipe</label>
                                                <select className="input-luxury cursor-pointer" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                                    <option value="end_customer">Umum</option>
                                                    <option value="reseller">Reseller</option>
                                                    <option value="vip">VIP</option>
                                                </select>
                                            </div>
                                            <div className="group">
                                                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">No. HP</label>
                                                <input className="input-luxury font-mono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="08..." />
                                            </div>
                                        </div>

                                        <div className="group">
                                            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block group-focus-within:text-primary transition-colors">Alamat Lengkap</label>
                                            <textarea rows="3" className="input-luxury resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Alamat pengiriman..."></textarea>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-50 border border-transparent hover:border-border transition-all">
                                            Batal
                                        </button>
                                        <button type="submit" className="btn-gold px-6 py-2.5 shadow-md">
                                            Simpan Data
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
}