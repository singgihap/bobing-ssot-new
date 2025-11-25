"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch, limit } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// --- KONFIGURASI CACHE (OPTIMIZED) ---
const CACHE_KEY = 'lumina_customers_v2';
const CACHE_DURATION = 30 * 60 * 1000; // 30 Menit (Data customer jarang berubah drastis)

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [scanning, setScanning] = useState(false);

    useEffect(() => { fetchData(); }, []);

    // 1. Fetch Data (Optimized with LocalStorage)
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

            // B. Fetch Firebase (Limit 100)
            const q = query(collection(db, "customers"), orderBy("name", "asc"), limit(100));
            const snap = await getDocs(q);
            const data = [];
            snap.forEach(d => data.push({id: d.id, ...d.data()}));
            
            setCustomers(data);
            
            // C. Simpan Cache LocalStorage
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

    const scanFromSales = async () => {
        if(!confirm("Scan 500 transaksi terakhir untuk pelanggan baru?")) return;
        setScanning(true);
        const scanPromise = new Promise(async (resolve, reject) => {
            try {
                // Query Heavy: 500 Reads (Hanya dijalankan manual oleh user)
                const qSales = query(collection(db, "sales_orders"), orderBy("order_date", "desc"), limit(500));
                const snapSales = await getDocs(qSales);
                const newCandidates = {};
                
                // Process Data in Memory
                snapSales.forEach(doc => {
                    const s = doc.data();
                    const name = s.customer_name || '';
                    const phone = s.customer_phone || ''; // Pastikan field ini ada di sales order atau sesuaikan logic
                    
                    // Basic validation untuk nomor hp valid dan bukan tamu (*)
                    if (name && !name.toLowerCase().includes('guest') && !name.includes('*')) {
                        // Gunakan Nama sebagai key unik jika phone tidak ada, atau phone jika ada
                        const key = phone.length > 5 ? phone : name.toLowerCase();
                        
                        if (!newCandidates[key]) {
                            newCandidates[key] = { 
                                name, 
                                phone, 
                                address: s.shipping_address || '', 
                                type: 'end_customer' 
                            };
                        }
                    }
                });

                // Filter Duplikat dari State (Client Side)
                // Note: Ini hanya membandingkan dengan 100 customer yang terload. 
                // Idealnya cek ke DB, tapi demi hemat cost, kita filter based on cache dulu.
                const existingNames = new Set(customers.map(c => c.name.toLowerCase()));
                const existingPhones = new Set(customers.map(c => c.phone));

                const finalToAdd = Object.values(newCandidates).filter(c => {
                    const hasPhone = c.phone && existingPhones.has(c.phone);
                    const hasName = existingNames.has(c.name.toLowerCase());
                    return !hasPhone && !hasName;
                });

                if (finalToAdd.length === 0) {
                    resolve("Tidak ditemukan pelanggan baru yang belum tersimpan.");
                } else {
                    // Batch Write (Max 500 operations)
                    const batch = writeBatch(db);
                    // Limit batch to 400 to be safe
                    const batchList = finalToAdd.slice(0, 400);
                    
                    batchList.forEach(c => {
                        const ref = doc(collection(db, "customers"));
                        batch.set(ref, { ...c, created_at: serverTimestamp(), source: 'auto_scan' });
                    });
                    
                    await batch.commit();
                    
                    // Invalidate Cache
                    if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                    fetchData(true);
                    
                    resolve(`Berhasil menyimpan ${batchList.length} pelanggan baru!`);
                }
            } catch (e) { 
                reject(e); 
            } finally { 
                setScanning(false); 
            }
        });

        toast.promise(scanPromise, {
            loading: 'Scanning sales history...',
            success: (msg) => msg,
            error: (err) => `Gagal: ${err.message}`,
        });
    };

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
                
                // Refresh Cache
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

    return (
        <div className="max-w-7xl mx-auto space-y-6 fade-in pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 className="text-xl md:text-3xl font-bold text-text-primary font-display">Customers</h2>
                <p className="text-sm text-text-secondary mt-1 font-light">CRM database for resellers and loyal customers.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={scanFromSales} disabled={scanning} className="btn-ghost-dark text-xs">
                {scanning ? 'Scanning...' : 'Scan Recent Sales'}
                </button>
                <button onClick={() => openModal()} className="btn-gold">
                New Customer
                </button>
            </div>
            </div>


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
                            {loading ? <tr><td colSpan="5" className="text-center py-12 text-text-secondary">Loading...</td></tr> : customers.map(c => (
                                <tr key={c.id}>
                                    <td className="pl-6 font-medium text-text-primary">{c.name}</td>
                                    <td><span className="badge-luxury badge-neutral">{c.type?.replace('_', ' ')}</span></td>
                                    <td className="font-mono text-text-secondary text-xs">{c.phone || '-'}</td>
                                    <td className="text-text-secondary truncate max-w-xs text-xs">{c.address || '-'}</td>
                                    <td className="text-right pr-6">
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => openModal(c)} className="text-xs font-bold text-text-secondary hover:text-text-primary transition-colors">Edit</button>
                                            <button onClick={() => deleteItem(c.id)} className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors">Del</button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4 fade-in">
                    <div className="bg-surface border border-lumina-border rounded-2xl shadow-2xl max-w-lg w-full p-6 ring-1 ring-lumina-gold/20">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-lumina-border">
                            <h3 className="text-lg font-bold text-text-primary">{formData.id ? 'Edit Customer' : 'New Customer'}</h3>
                            <button onClick={() => setModalOpen(false)} className="text-text-secondary hover:text-text-primary text-xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Name</label>
                                    <input required className="input-luxury" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Type</label>
                                    <select className="input-luxury" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                        <option value="end_customer">Customer Umum</option>
                                        <option value="reseller">Reseller / Agen</option>
                                        <option value="vip">VIP</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Phone / WA</label>
                                <input className="input-luxury" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="08..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Address</label>
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
            </Portal>
        </div>
    );
}