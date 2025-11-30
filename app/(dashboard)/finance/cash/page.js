// app/(dashboard)/finance/cash/page.js
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, writeBatch, addDoc, serverTimestamp, doc, increment, getDoc } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';
import { useAuth } from '@/context/AuthContext'; 
import toast from 'react-hot-toast';

// UI Imports
import { 
    ArrowUpCircle, ArrowDownCircle, Wallet, Search, Filter, 
    Calendar, ChevronDown, ArrowUpRight, ArrowDownLeft, Plus, X, Save, Building,
    Trash2, Edit2, AlertTriangle, Zap, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper Date
const safeDate = (dateInput) => {
    if (!dateInput) return new Date();
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? new Date() : d;
};

export default function CashTransactionsPage() {
  const { user } = useAuth();

  // Data State
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]); 
  const [metrics, setMetrics] = useState({ totalIn: 0, totalOut: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all'); 
  
  // UI State
  const [expandedDate, setExpandedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form State
  const [form, setForm] = useState({ 
      type: 'out', 
      amount: '', 
      date: new Date().toISOString().split('T')[0],
      walletId: '',   
      categoryId: '', 
      description: ''
  });

  useEffect(() => { fetchMasterData(); }, []);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const qAcc = query(collection(db, "chart_of_accounts"), orderBy("code", "asc"));
      const snapAcc = await getDocs(qAcc);
      const coaList = snapAcc.docs.map(d => ({ id: d.id, ...d.data() }));
      setAccounts(coaList);

      const defWallet = coaList.find(a => a.code.startsWith('1') && (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank')));
      if(defWallet) setForm(f => ({ ...f, walletId: defWallet.id }));

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

  const openAddModal = () => {
      setEditingId(null);
      setForm(prev => ({ ...prev, amount: '', categoryId: '', description: '', date: new Date().toISOString().split('T')[0] }));
      setIsModalOpen(true);
  };

  const openEditModal = (item) => {
      setEditingId(item.id);
      const dateStr = item.date instanceof Date ? item.date.toISOString().split('T')[0] : '';
      setForm({
          type: item.type, 
          amount: item.amount,
          walletId: item.account_id,
          categoryId: item.category_account_id || '',
          description: item.description, 
          date: dateStr
      });
      setIsModalOpen(true);
  };

  const handleSave = async (e) => {
      e.preventDefault();
      if(!form.amount || !form.walletId || !form.categoryId) return toast.error("Lengkapi data!");
      
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
              // Uang Keluar (Kredit)
              walletAdj = -amountVal; 
              
              // Lawan (Debit)
              const catType = String(category.code).charAt(0);
              if (['1', '5', '6'].includes(catType)) categoryAdj = amountVal; // Bertambah
              else categoryAdj = -amountVal; // Berkurang
          } 
          else {
              // Uang Masuk (Debit)
              walletAdj = amountVal;

              // Lawan (Kredit)
              const catType = String(category.code).charAt(0);
              if (['2', '3', '4'].includes(catType)) categoryAdj = amountVal; // Bertambah
              else categoryAdj = -amountVal; // Berkurang
          }

          // A. Edit Mode (Simplified Revert Logic not fully implemented for safety, assuming overwrite)
          if (editingId) {
             const transRef = doc(db, "cash_transactions", editingId);
             batch.update(transRef, {
                 amount: amountVal,
                 type: form.type,
                 account_id: form.walletId,
                 category_account_id: form.categoryId,
                 category: category.name,
                 description: form.description,
                 date: timestamp,
                 updated_at: serverTimestamp()
             });
          } else {
             // B. New Transaction
             const transRef = doc(collection(db, "cash_transactions"));
             batch.set(transRef, {
                 amount: amountVal,
                 type: form.type,
                 account_id: form.walletId,
                 category_account_id: form.categoryId,
                 category: category.name,
                 description: form.description,
                 date: timestamp,
                 created_at: serverTimestamp(),
                 ref_type: 'manual',
                 debit: form.type === 'in' ? amountVal : 0,
                 credit: form.type === 'out' ? amountVal : 0
             });
          }

          // UPDATE SALDO
          const walletRef = doc(db, "chart_of_accounts", form.walletId);
          batch.update(walletRef, { balance: increment(walletAdj), updated_at: serverTimestamp() });

          const catRef = doc(db, "chart_of_accounts", form.categoryId);
          batch.update(catRef, { balance: increment(categoryAdj), updated_at: serverTimestamp() });

          await batch.commit();
          toast.success("Transaksi Tercatat!", { id: tId });
          setIsModalOpen(false); fetchTransactions();

      } catch(e) { console.error(e); toast.error(e.message, { id: tId }); }
  };

  const handleDelete = async (item) => {
      if(!confirm("Hapus transaksi ini?")) return;
      const tId = toast.loading("Menghapus...");
      try {
          const batch = writeBatch(db);
          const walletRef = doc(db, "chart_of_accounts", item.account_id);
          const revWallet = item.type === 'in' ? -item.amount : item.amount;
          batch.update(walletRef, { balance: increment(revWallet) });

          if(item.category_account_id) {
              const catRef = doc(db, "chart_of_accounts", item.category_account_id);
              batch.update(catRef, { balance: increment(-item.amount) });
          }

          batch.delete(doc(db, "cash_transactions", item.id));
          await batch.commit();
          toast.success("Dihapus", { id: tId });
          fetchTransactions();
      } catch(e) { toast.error(e.message, { id: tId }); }
  };

  // --- FILTER & GROUPING ---
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h1 className="text-2xl font-bold text-text-primary">Buku Kas (Jurnal)</h1><p className="text-sm text-text-secondary">Catat pemasukan & pengeluaran manual.</p></div>
          <button onClick={openAddModal} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4"/> Catat Transaksi</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Total Masuk (Periode Ini)" value={formatRupiah(metrics.totalIn)} color="text-emerald-600" icon={ArrowDownLeft} />
        <MetricCard title="Total Keluar (Periode Ini)" value={formatRupiah(metrics.totalOut)} color="text-rose-600" icon={ArrowUpRight} />
        <MetricCard title="Net Cash Flow" value={formatRupiah(metrics.netBalance)} color="text-blue-600" icon={Wallet} />
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-3 rounded-2xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/><input className="pl-10 pr-4 py-2 bg-gray-50 border border-border rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Cari deskripsi..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
          <select className="px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs font-bold" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">Semua Tipe</option><option value="in">Pemasukan</option><option value="out">Pengeluaran</option></select>
          <select className="px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs font-bold" value={filterAccount} onChange={e=>setFilterAccount(e.target.value)}><option value="all">Semua Akun Kas</option>{accounts.filter(a=>a.code.startsWith('1')).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      </div>

      {/* LIST TRANSAKSI */}
      <div className="space-y-4">
          {loading ? <Skeleton className="h-32 w-full rounded-2xl"/> : groupedTransactions.length===0 ? <div className="p-10 text-center text-text-secondary border-2 border-dashed border-border rounded-2xl">Belum ada transaksi manual.</div> : 
           groupedTransactions.map((group) => (
              <div key={group.dateLabel} className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                  <div onClick={()=>setExpandedDate(expandedDate===group.dateLabel?null:group.dateLabel)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className="bg-white border border-border p-2 rounded-lg text-xs font-bold shadow-sm uppercase w-12 text-center leading-tight">
                             {group.dateLabel.split(' ')[0]} <br/><span className="text-[10px] font-normal text-text-secondary">{group.dateLabel.split(' ')[1].substring(0,3)}</span>
                        </div>
                        <div>
                             <h3 className="font-bold text-sm text-text-primary">{group.dateLabel}</h3>
                             <p className="text-xs text-text-secondary">{group.items.length} Transaksi</p>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${group.netFlow>=0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {group.netFlow > 0 ? '+' : ''}{formatRupiah(group.netFlow)}
                      </div>
                  </div>
                  <AnimatePresence>
                  {(expandedDate === group.dateLabel || !expandedDate) && (
                      <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="divide-y divide-border/50">
                          {group.items.map(item => (
                              <div key={item.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-blue-50/30 transition-colors group/item gap-3">
                                  <div className="flex items-center gap-3 w-full sm:w-auto">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type==='in'?'bg-emerald-100 text-emerald-600':'bg-rose-100 text-rose-600'}`}>
                                          {item.type==='in'?<ArrowDownLeft className="w-4 h-4"/>:<ArrowUpRight className="w-4 h-4"/>}
                                      </div>
                                      <div className="min-w-0">
                                          <p className="font-bold text-sm text-text-primary truncate pr-2">{item.description}</p>
                                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
                                              <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 truncate max-w-[100px]">{accounts.find(a=>a.id===item.account_id)?.name || 'Kas'}</span>
                                              <ArrowRight className="w-3 h-3 text-gray-300"/>
                                              <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 truncate max-w-[100px]">{item.category}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-between w-full sm:w-auto gap-4 pl-11 sm:pl-0">
                                      <span className={`font-mono font-bold text-sm ${item.type==='in'?'text-emerald-600':'text-rose-600'}`}>
                                          {item.type==='in'?'+':'-'} {formatRupiah(item.amount)}
                                      </span>
                                      <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover/item:opacity-100 transition-opacity">
                                          <button onClick={()=>openEditModal(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5"/></button>
                                          <button onClick={()=>handleDelete(item)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </motion.div>
                  )}
                  </AnimatePresence>
              </div>
           ))}
      </div>

      {/* --- MODAL FORM DOUBLE ENTRY (RE-DESIGNED) --- */}
      <AnimatePresence>
          {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                  <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.95, opacity:0}} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">
                      
                      <div className="px-6 py-4 border-b border-border bg-gray-50 flex justify-between items-center shrink-0">
                          <div>
                              <h3 className="text-lg font-bold text-text-primary">{editingId ? "Edit Jurnal" : "Catat Transaksi"}</h3>
                              <p className="text-xs text-text-secondary">Input manual buku kas (Double Entry).</p>
                          </div>
                          <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-text-secondary hover:text-rose-500 transition-colors"/></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                          
                          {/* 1. TIPE TRANSAKSI */}
                          <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-xl">
                              <button 
                                type="button" 
                                onClick={() => setForm({...form, type: 'out'})} 
                                className={`py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${form.type === 'out' ? 'bg-white text-rose-600 shadow-md ring-1 ring-rose-100' : 'text-text-secondary hover:bg-gray-200'}`}
                              >
                                  <ArrowUpRight className="w-4 h-4"/> Pengeluaran
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setForm({...form, type: 'in'})} 
                                className={`py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${form.type === 'in' ? 'bg-white text-emerald-600 shadow-md ring-1 ring-emerald-100' : 'text-text-secondary hover:bg-gray-200'}`}
                              >
                                  <ArrowDownLeft className="w-4 h-4"/> Pemasukan
                              </button>
                          </div>

                          {/* 2. NOMINAL */}
                          <div>
                              <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Nominal (Rp)</label>
                              <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-text-secondary opacity-50">Rp</span>
                                  <input 
                                    type="number" 
                                    autoFocus
                                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-border rounded-xl text-2xl font-bold outline-none focus:ring-2 focus:bg-white transition-all ${form.type === 'in' ? 'text-emerald-600 focus:ring-emerald-500/20 focus:border-emerald-500' : 'text-rose-600 focus:ring-rose-500/20 focus:border-rose-500'}`} 
                                    placeholder="0" 
                                    value={form.amount} 
                                    onChange={e => setForm({...form, amount: e.target.value})} 
                                  />
                              </div>
                          </div>

                          {/* 3. FLOW (DARI -> KE) */}
                          <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-4 relative">
                              <div className="absolute left-[23px] top-[40px] bottom-[40px] w-0.5 bg-blue-200/50 border-l border-dashed border-blue-300"></div>

                              {/* FIELD 1: SUMBER (KREDIT) */}
                              <div className="relative">
                                  <label className="text-[10px] font-bold text-text-secondary uppercase mb-1.5 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                                      {form.type === 'out' ? "Bayar Dari (Kredit)" : "Terima Dari (Kredit)"}
                                  </label>
                                  <div className="relative z-10">
                                      {form.type === 'out' ? (
                                          // OUT: Sumber = Wallet (Kas/Bank/Piutang) -> UPDATED FILTER
                                          <select className="input-luxury pl-3 text-sm" value={form.walletId} onChange={e => setForm({...form, walletId: e.target.value})}>
                                              <option value="">-- Pilih Akun Sumber --</option>
                                              {accounts.filter(a => {
                                                  // Allow 11xx (Kas/Bank) AND 12xx (Piutang)
                                                  // ATAU jika nama mengandung kata-kata kunci tertentu
                                                  const code = String(a.code);
                                                  const name = (a.name || '').toLowerCase();
                                                  return code.startsWith('11') || code.startsWith('12') || name.includes('kas') || name.includes('bank') || name.includes('saldo');
                                              }).map(a => (
                                                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                              ))}
                                          </select>
                                      ) : (
                                          // IN: Sumber = Pendapatan/Lainnya
                                          <select className="input-luxury pl-3 text-sm" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                                              <option value="">-- Pilih Sumber Dana --</option>
                                              {accounts.filter(a => ['4','2','3'].includes(a.code.charAt(0)) || a.name.includes('Piutang')).map(a => (
                                                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                              ))}
                                          </select>
                                      )}
                                  </div>
                              </div>

                              {/* FIELD 2: TUJUAN (DEBIT) */}
                              <div className="relative">
                                  <label className="text-[10px] font-bold text-text-secondary uppercase mb-1.5 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                      {form.type === 'out' ? "Untuk Keperluan (Debit)" : "Masuk Ke Akun (Debit)"}
                                  </label>
                                  <div className="relative z-10">
                                      {form.type === 'out' ? (
                                          // OUT: Tujuan = Beban/Aset/Hutang
                                          <select className="input-luxury pl-3 text-sm" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                                              <option value="">-- Pilih Pos Pengeluaran --</option>
                                              {accounts.filter(a => ['5','1','2','6'].includes(a.code.charAt(0)) && !a.name.toLowerCase().includes('kas')).map(a => (
                                                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                              ))}
                                          </select>
                                      ) : (
                                          // IN: Tujuan = Wallet (Kas)
                                          <select className="input-luxury pl-3 text-sm" value={form.walletId} onChange={e => setForm({...form, walletId: e.target.value})}>
                                              <option value="">-- Pilih Akun Kas/Bank --</option>
                                              {accounts.filter(a => a.code.startsWith('1') && (a.category?.includes('KAS') || a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))).map(a => (
                                                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                              ))}
                                          </select>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {/* 4. DETAILS */}
                          <div className="grid grid-cols-3 gap-4">
                              <div className="col-span-2">
                                  <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Keterangan</label>
                                  <input className="input-luxury" placeholder="Contoh: Topup Iklan Shopee" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-text-secondary uppercase mb-1.5 block">Tanggal</label>
                                  <input type="date" className="input-luxury text-xs px-2" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                              </div>
                          </div>
                      </div>

                      <div className="p-5 border-t border-border bg-gray-50 flex justify-end gap-3 shrink-0">
                          <button onClick={() => setIsModalOpen(false)} className="btn-ghost-dark">Batal</button>
                          <button onClick={handleSave} className={`btn-primary px-8 shadow-lg ${form.type === 'out' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                              <Save className="w-4 h-4 mr-2"/> Simpan
                          </button>
                      </div>

                  </motion.div>
              </div>
          )}
      </AnimatePresence>
    </div>
  );
}