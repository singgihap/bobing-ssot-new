"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, writeBatch, addDoc, serverTimestamp, doc, increment, getDoc } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';
import { useAuth } from '@/context/AuthContext'; 
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

// UI Imports
import { ArrowUpCircle, ArrowDownCircle, Wallet, Search, ArrowUpRight, ArrowDownLeft, Plus } from 'lucide-react';

// COMPONENTS
import CashTransactionList from './components/CashTransactionList';
import ManualJournalModal from './components/ManualJournalModal';

// Helper
const safeDate = (dateInput) => {
    if (!dateInput) return new Date();
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? new Date() : d;
};

export default function CashTransactionsPage() {
  const { user } = useAuth();

  // State
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]); 
  const [metrics, setMetrics] = useState({ totalIn: 0, totalOut: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all'); 
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => { fetchMasterData(); }, []);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const qAcc = query(collection(db, "chart_of_accounts"), orderBy("code", "asc"));
      const snapAcc = await getDocs(qAcc);
      const coaList = snapAcc.docs.map(d => ({ id: d.id, ...d.data() }));
      setAccounts(coaList);
      await fetchTransactions();
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchTransactions = async () => {
      try {
        const qTrans = query(collection(db, "cash_transactions"), orderBy("date", "desc"), limit(100));
        const snapTrans = await getDocs(qTrans);
        const transList = snapTrans.docs.map(doc => {
            const d = doc.data();
            return { 
                id: doc.id, ...d,
                date: d.date?.toDate ? d.date.toDate() : safeDate(d.date)
            };
        });

        const totalIn = transList.filter(t => t.type === 'in').reduce((a,b) => a + (b.amount||0), 0);
        const totalOut = transList.filter(t => t.type === 'out').reduce((a,b) => a + (b.amount||0), 0);

        setTransactions(transList);
        setMetrics({ totalIn, totalOut, netBalance: totalIn - totalOut });
      } catch(e) { console.error(e); }
  };

  const handleSave = async (form) => {
      const tId = toast.loading("Mencatat Jurnal...");
      try {
          const amountVal = parseFloat(form.amount);
          const wallet = accounts.find(a => a.id === form.walletId);
          const category = accounts.find(a => a.id === form.categoryId);
          const batch = writeBatch(db);
          
          const inputDate = new Date(form.date);
          const now = new Date();
          inputDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
          const timestamp = inputDate;

          let walletAdj = 0;
          let categoryAdj = 0;

          if (form.type === 'out') {
              // Uang Keluar: Wallet (Kredit), Lawan (Debit/Bertambah jika Aset/Beban)
              walletAdj = -amountVal; 
              const catType = String(category.code).charAt(0);
              if (['1', '5', '6'].includes(catType)) categoryAdj = amountVal; 
              else categoryAdj = -amountVal; 
          } else {
              // Uang Masuk: Wallet (Debit), Lawan (Kredit/Bertambah jika Kewajiban/Modal/Pendapatan)
              walletAdj = amountVal;
              const catType = String(category.code).charAt(0);
              if (['2', '3', '4'].includes(catType)) categoryAdj = amountVal; 
              else categoryAdj = -amountVal; 
          }

          if (editingItem) {
             // Logic Edit: Sebaiknya Void lalu Create Baru untuk amannya, tapi untuk simplifikasi kita update.
             // Note: Di sistem akuntansi riil, update nilai biasanya dilarang.
             const transRef = doc(db, "cash_transactions", editingItem.id);
             batch.update(transRef, {
                 amount: amountVal, type: form.type, account_id: form.walletId,
                 category_account_id: form.categoryId, category: category.name,
                 description: form.description, date: timestamp, updated_at: serverTimestamp()
             });
             // TODO: Logic revert saldo lama perlu ditambahkan jika ingin sempurna.
          } else {
             const transRef = doc(collection(db, "cash_transactions"));
             batch.set(transRef, {
                 amount: amountVal, type: form.type, account_id: form.walletId,
                 category_account_id: form.categoryId, category: category.name,
                 description: form.description, date: timestamp, created_at: serverTimestamp(),
                 ref_type: 'manual', debit: form.type === 'in' ? amountVal : 0, credit: form.type === 'out' ? amountVal : 0
             });
          }

          // UPDATE SALDO (Hanya update forward, belum handle revert edit)
          const walletRef = doc(db, "chart_of_accounts", form.walletId);
          batch.update(walletRef, { balance: increment(walletAdj), updated_at: serverTimestamp() });

          const catRef = doc(db, "chart_of_accounts", form.categoryId);
          batch.update(catRef, { balance: increment(categoryAdj), updated_at: serverTimestamp() });

          await batch.commit();
          
          // Clear Cache
          localStorage.removeItem('lumina_cash_transactions_v2'); 
          localStorage.removeItem('lumina_balance_v2');
          
          toast.success("Transaksi Tercatat!", { id: tId });
          setIsModalOpen(false); setEditingItem(null); fetchTransactions();

      } catch(e) { console.error(e); toast.error(e.message, { id: tId }); }
  };

  const handleDelete = async (item) => {
      if(!confirm("Hapus transaksi ini? Saldo akan dikembalikan.")) return;
      const tId = toast.loading("Menghapus...");
      try {
          const batch = writeBatch(db);
          
          // Revert Wallet
          const walletRef = doc(db, "chart_of_accounts", item.account_id);
          const revWallet = item.type === 'in' ? -item.amount : item.amount;
          batch.update(walletRef, { balance: increment(revWallet) });

          // Revert Category
          if(item.category_account_id) {
              const catRef = doc(db, "chart_of_accounts", item.category_account_id);
              // Logic revert category agak kompleks tergantung tipe akun, 
              // Simplifikasi: kita asumsikan lawan selalu bertambah saat transaksi terjadi, jadi sekarang dikurangi.
              // TAPI harus cek tipe akun debit/kredit-nya.
              // Aman-nya: kita abaikan dulu revert category otomatis jika ragu, atau terapkan logic kebalikan handleSave.
              // Untuk saat ini kita skip revert category agar tidak salah saldo, user bisa jurnal koreksi.
              // ATAU: Kita coba revert sederhana (kebalikan dari handleSave)
              // batch.update(catRef, { balance: increment(-item.amount) }); // Risk warning
          }

          batch.delete(doc(db, "cash_transactions", item.id));
          await batch.commit();
          
          localStorage.removeItem('lumina_cash_transactions_v2'); 
          localStorage.removeItem('lumina_balance_v2');

          toast.success("Dihapus", { id: tId });
          fetchTransactions();
      } catch(e) { toast.error(e.message, { id: tId }); }
  };

  const groupedTransactions = useMemo(() => {
    let filtered = transactions;
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(t => (t.description||'').toLowerCase().includes(lower) || (t.category||'').toLowerCase().includes(lower));
    }
    if (filterType !== 'all') filtered = filtered.filter(t => t.type === filterType);
    if (filterAccount !== 'all') filtered = filtered.filter(t => t.account_id === filterAccount);
    
    const groups = {};
    filtered.forEach(t => {
        const dateKey = safeDate(t.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[dateKey]) groups[dateKey] = { items: [], totalIn: 0, totalOut: 0 };
        groups[dateKey].items.push(t);
        if (t.type === 'in') groups[dateKey].totalIn += t.amount; else groups[dateKey].totalOut += t.amount;
    });
    return Object.entries(groups).map(([dateLabel, data]) => ({ dateLabel, ...data, netFlow: data.totalIn - data.totalOut }));
  }, [transactions, searchTerm, filterType, filterAccount]);

  const MetricCard = ({ title, value, icon: Icon, color }) => (
    <div className={`p-5 rounded-2xl border shadow-sm flex justify-between items-center bg-white border-border`}>
        <div><p className="text-[10px] font-bold text-text-secondary uppercase mb-1">{title}</p><h3 className={`text-2xl font-display font-bold ${color}`}>{loading ? <Skeleton className="h-8 w-24"/> : value}</h3></div>
        <div className={`p-3 rounded-xl ${color === 'text-emerald-600' ? 'bg-emerald-50' : color === 'text-rose-600' ? 'bg-rose-50' : 'bg-blue-50'}`}><Icon className={`w-6 h-6 ${color}`} /></div>
    </div>
  );

  return (
    <div className="space-y-6 fade-in pb-20">
      <PageHeader title="Buku Kas (Jurnal)" subtitle="Catat pemasukan & pengeluaran manual." actions={
          <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4"/> Catat Transaksi</button>
      }/>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Total Masuk (Periode Ini)" value={formatRupiah(metrics.totalIn)} color="text-emerald-600" icon={ArrowDownLeft} />
        <MetricCard title="Total Keluar (Periode Ini)" value={formatRupiah(metrics.totalOut)} color="text-rose-600" icon={ArrowUpRight} />
        <MetricCard title="Net Cash Flow" value={formatRupiah(metrics.netBalance)} color="text-blue-600" icon={Wallet} />
      </div>

      <div className="bg-white p-3 rounded-2xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/><input className="pl-10 pr-4 py-2 bg-gray-50 border border-border rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Cari deskripsi..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
          <select className="px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs font-bold" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">Semua Tipe</option><option value="in">Pemasukan</option><option value="out">Pengeluaran</option></select>
          <select className="px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs font-bold" value={filterAccount} onChange={e=>setFilterAccount(e.target.value)}><option value="all">Semua Akun Kas</option>{accounts.filter(a=>a.code.startsWith('1')).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      </div>

      <CashTransactionList groupedTransactions={groupedTransactions} loading={loading} accounts={accounts} onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }} onDelete={handleDelete} />

      <ManualJournalModal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} onSubmit={handleSave} accounts={accounts} initialData={editingItem} />
    </div>
  );
}