"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp, updateDoc, limit } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';
import toast from 'react-hot-toast';

// UI
import { Search, Plus, Trash2, Edit2, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CACHE_KEY = 'lumina_finance_accounts_v2';
const CACHE_DURATION = 30 * 60 * 1000;

export default function FinanceAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Client-side search
  
  const [formData, setFormData] = useState({ code: '', name: '', category: '' });

  const accountCategories = [
    'ASET (ASSETS)', 'ASET (CONTRA)', 'KEWAJIBAN (LIABILITIES)', 
    'EKUITAS (EQUITY)', 'PENDAPATAN (REVENUE)', 'PENDAPATAN (CONTRA)', 'BEBAN (EXPENSES)'
  ];

  useEffect(() => { fetchAccounts(); }, []);

  const invalidateCaches = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('lumina_cash_categories_v2');
    localStorage.removeItem('lumina_pos_master_v2');
    localStorage.removeItem('lumina_cash_data_v2');
  };

  const fetchAccounts = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (!forceRefresh && typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setAccounts(data);
            setLoading(false);
            return;
          }
        }
      }

      const q = query(collection(db, 'chart_of_accounts'), orderBy('code', 'asc'), limit(200));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setAccounts(data);
      if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));

    } catch (error) { toast.error('Gagal memuat akun'); } finally { setLoading(false); }
  };

  const toggleStatus = async (id, currentStatus) => {
    const t = toast.loading("Updating...");
    try {
      const newStatus = (currentStatus === 'Aktif' || currentStatus === 'Active') ? 'Tidak Aktif' : 'Aktif';
      await updateDoc(doc(db, 'chart_of_accounts', id), { status: newStatus, updated_at: serverTimestamp() });
      invalidateCaches();
      fetchAccounts(true);
      toast.success(`Status: ${newStatus}`, { id: t });
    } catch (error) { toast.error('Gagal update', { id: t }); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      if (accounts.some(a => a.code === formData.code)) throw new Error('Kode akun sudah ada!');
      
      await addDoc(collection(db, 'chart_of_accounts'), {
        ...formData, status: 'Aktif', createdAt: serverTimestamp(), updated_at: serverTimestamp()
      });

      setModalOpen(false);
      invalidateCaches();
      fetchAccounts(true);
      toast.success('Akun berhasil dibuat!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteAccount = async (id) => {
    if (!confirm('Hapus akun ini?')) return;
    try {
      await deleteDoc(doc(db, 'chart_of_accounts', id));
      invalidateCaches();
      fetchAccounts(true);
      toast.success('Akun dihapus');
    } catch (error) { toast.error('Gagal menghapus'); }
  };

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.code.includes(searchTerm)
  );

  return (
    <div className="space-y-6 fade-in pb-20">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
        <div className="relative w-full md:w-80 group">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3 group-focus-within:text-primary transition-colors" />
            <input 
                type="text" 
                className="w-full pl-10 py-2.5 text-sm bg-gray-50 border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                placeholder="Cari Kode / Nama Akun..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <button onClick={() => { setFormData({code:'', name:'', category:''}); setModalOpen(true); }} className="btn-gold flex items-center gap-2 shadow-lg">
          <Plus className="w-4 h-4 stroke-[3px]" /> Add Account
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
              <tr>
                <th className="pl-6 py-4">Code</th>
                <th className="py-4">Account Name</th>
                <th className="py-4">Category</th>
                <th className="text-center py-4">Status</th>
                <th className="text-right pr-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border/60">
              {loading ? (
                <tr><td colSpan="5" className="p-12 text-center text-text-secondary animate-pulse">Memuat data...</td></tr>
              ) : filteredAccounts.length === 0 ? (
                <tr><td colSpan="5" className="p-12 text-center text-text-secondary">Tidak ada data akun.</td></tr>
              ) : (
                filteredAccounts.map((account) => {
                  const isActive = account.status === 'Aktif' || account.status === 'Active';
                  return (
                    <tr key={account.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="pl-6 py-3 font-mono font-bold text-primary">{account.code}</td>
                      <td className="py-3 font-medium text-text-primary">{account.name}</td>
                      <td className="py-3">
                        <span className="text-[10px] bg-gray-100 px-2 py-1 rounded border border-border text-text-secondary font-bold uppercase">{account.category}</span>
                      </td>
                      <td className="text-center py-3">
                        <button
                          onClick={() => toggleStatus(account.id, account.status)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'}`}
                        >
                          {isActive ? <ShieldCheck className="w-3 h-3"/> : <ShieldAlert className="w-3 h-3"/>}
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="text-right pr-6 py-3">
                        <button onClick={() => deleteAccount(account.id)} className="p-2 text-text-secondary hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Portal>
        <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.95, opacity:0}} className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border">
              <div className="px-6 py-5 border-b border-border bg-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-text-primary">Add Account</h3>
                <button onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-text-secondary hover:text-rose-500"/></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Account Code</label>
                  <input className="input-luxury font-mono" value={formData.code} onChange={e=>setFormData({...formData, code:e.target.value})} placeholder="e.g. 1101" maxLength="10" required autoFocus />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Account Name</label>
                  <input className="input-luxury" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="e.g. Kas Besar" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Category</label>
                  <select className="input-luxury" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} required>
                    <option value="">-- Select Category --</option>
                    {accountCategories.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={()=>setModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                    <button type="submit" disabled={uploading} className="btn-gold px-6 shadow-md">{uploading ? 'Saving...' : 'Save Account'}</button>
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