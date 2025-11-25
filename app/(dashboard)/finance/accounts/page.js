// app/finance-accounts/page.js
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp, updateDoc, limit } from 'firebase/firestore';
import { Portal } from '@/lib/usePortal';

// Konfigurasi Cache (Optimized)
const CACHE_KEY = 'lumina_finance_accounts_v2';
const CACHE_DURATION = 30 * 60 * 1000; // 30 Menit

export default function FinanceAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
  });

  const accountCategories = [
    'ASET (ASSETS)',
    'ASET (CONTRA)',
    'KEWAJIBAN (LIABILITIES)',
    'EKUITAS (EQUITY)',
    'PENDAPATAN (REVENUE)',
    'PENDAPATAN (CONTRA)',
    'BEBAN (EXPENSES)',
  ];

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Helper: Invalidate Related Caches
  const invalidateCaches = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY); // Self
    localStorage.removeItem('lumina_cash_categories_v2'); // Dropdown Kategori di Cash Flow
    localStorage.removeItem('lumina_pos_master_v2'); // Pilihan Akun Pembayaran di POS
    localStorage.removeItem('lumina_cash_data_v2'); // List Akun di Cash Flow
  };

  const fetchAccounts = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // 1. Cek Cache LocalStorage
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

      // 2. Fetch Data
      const q = query(
        collection(db, 'chart_of_accounts'),
        orderBy('code', 'asc'),
        limit(200) // Safety limit
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setAccounts(data);

      // 3. Simpan Cache LocalStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
      }

    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const isActive = (status) => {
    return status === 'Aktif' || status === 'Active';
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const accountRef = doc(db, 'chart_of_accounts', id);
      const isCurrentlyActive = isActive(currentStatus);
      const newStatus = isCurrentlyActive ? 'Tidak Aktif' : 'Aktif';
      
      await updateDoc(accountRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      
      invalidateCaches();
      fetchAccounts(true);
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    }
  };

  const openModal = (account = null) => {
    if (account) {
      setFormData({
        code: account.code,
        name: account.name,
        category: account.category,
      });
    } else {
      setFormData({
        code: '',
        name: '',
        category: '',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      if (!formData.code || !formData.name || !formData.category) {
        alert('Semua field harus diisi!');
        setUploading(false);
        return;
      }

      const existingAccounts = accounts.filter(a => a.code === formData.code);
      if (existingAccounts.length > 0) {
        alert('Kode akun sudah ada!');
        setUploading(false);
        return;
      }

      await addDoc(collection(db, 'chart_of_accounts'), {
        code: formData.code,
        name: formData.name,
        category: formData.category,
        status: 'Aktif', // Default: Aktif
        createdAt: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setModalOpen(false);
      invalidateCaches();
      fetchAccounts(true);
      
      alert('Akun berhasil ditambahkan!');
    } catch (error) {
      console.error('Error saving account:', error);
      alert('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteAccount = async (id) => {
    if (confirm('Hapus akun ini? Tindakan ini tidak dapat dibatalkan!')) {
      try {
        await deleteDoc(doc(db, 'chart_of_accounts', id));
        
        invalidateCaches();
        fetchAccounts(true);
        
        alert('Akun berhasil dihapus!');
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error: ' + error.message);
      }
    }
  };

  return (
    <div className="space-y-6 fade-in pb-20">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl md:text-3xl font-bold text-text-primary">Chart of Accounts</h2>
          <p className="text-text-secondary mt-1">Master financial accounts (Assets, Liabilities, Equity).</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors whitespace-nowrap"
        >
          + ADD ACCOUNT
        </button>
      </div>

      {/* Table Responsive Wrapper */}
      <div className="card-luxury overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-dark w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left pl-6 py-3 w-20">CODE</th>
                <th className="text-left">ACCOUNT NAME</th>
                <th className="text-left">CATEGORY</th>
                <th className="text-center w-32">STATUS</th>
                <th className="text-right pr-6 w-20">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-text-secondary">Loading...</td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-text-secondary">No accounts found.</td>
                </tr>
              ) : (
                accounts.map((account) => {
                  const statusIsActive = isActive(account.status);
                  
                  return (
                    <tr key={account.id} className="border-t border-lumina-border hover:bg-lumina-highlight/10 transition">
                      <td className="text-left pl-6 py-3 font-mono font-bold text-lumina-gold">{account.code}</td>
                      <td className="text-left text-text-primary py-3">{account.name}</td>
                      <td className="text-left py-3">
                        <span className="badge-luxury badge-neutral whitespace-nowrap">{account.category}</span>
                      </td>
                      
                      {/* TOGGLE STATUS BUTTON */}
                      <td className="text-center py-3">
                        <button
                          onClick={() => toggleStatus(account.id, account.status)}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-xs transition-all cursor-pointer ${
                            statusIsActive
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                          title="Click to toggle status"
                        >
                          <span className={`w-2 h-2 rounded-full ${statusIsActive ? 'bg-green-400' : 'bg-red-400'}`}></span>
                          {statusIsActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>
                      
                      <td className="text-right pr-6 py-3">
                        <button
                          onClick={() => deleteAccount(account.id)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors"
                        >
                          Del
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

      {/* MODAL */}
      <Portal>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-40"
              onClick={() => setModalOpen(false)}
            />

            <div className="relative z-50 bg-surface border border-lumina-border rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
              
              <div className="px-6 py-4 border-b border-lumina-border flex justify-between items-center bg-surface rounded-t-2xl flex-shrink-0">
                <h3 className="text-lg font-bold text-text-primary">Add New Account</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-text-secondary hover:text-text-primary transition-colors p-1"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 space-y-5 bg-surface custom-scrollbar">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Account Code</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-surface border border-lumina-border rounded-lg text-text-primary font-mono uppercase focus:border-lumina-gold outline-none"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., 1101"
                    disabled={uploading}
                    maxLength="10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Account Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-surface border border-lumina-border rounded-lg text-text-primary focus:border-lumina-gold outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Utang Gaji"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Category</label>
                  <select
                    required
                    className="w-full px-3 py-2 bg-surface border border-lumina-border rounded-lg text-text-primary focus:border-lumina-gold outline-none"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    disabled={uploading}
                  >
                    <option value="">-- Select Category --</option>
                    {accountCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </form>

              <div className="px-6 py-4 border-t border-lumina-border bg-surface rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2 bg-surface text-text-primary rounded-lg hover:bg-lumina-highlight transition-colors font-medium"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  className="px-8 py-2 bg-primary text-black rounded-lg hover:bg-yellow-400 transition-colors font-semibold flex items-center gap-2"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-transparent border-t-black rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    "ADD ACCOUNT"
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </Portal>
    </div>
  );
}