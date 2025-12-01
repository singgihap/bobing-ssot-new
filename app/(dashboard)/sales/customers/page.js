"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
    collection, getDocs, addDoc, doc, updateDoc, deleteDoc, 
    query, orderBy, serverTimestamp, writeBatch, limit, where, getDoc 
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { formatRupiah } from '@/lib/utils';

// 👇 PENTING: Import Portal
import { Portal } from '@/lib/usePortal';

// --- IMPORT COMPONENTS ---
import CustomerTable from './components/CustomerTable';
import CustomerCardList from './components/CustomerCardList';
import CustomerFormModal from './components/CustomerFormModal';
import ReceivablePaymentModal from './components/ReceivablePaymentModal';

// --- ICONS ---
import { Plus, Search, ScanLine, Wallet } from 'lucide-react';

// --- INTEGRASI FINANCE ---
import { recordTransaction } from '@/lib/transactionService';

const CACHE_KEY = 'lumina_customers_v2';
const CACHE_DURATION = 30 * 60 * 1000;

export default function CustomersPage() {
    // State Data
    const [customers, setCustomers] = useState([]);
    const [debtMap, setDebtMap] = useState({});
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Action States
    const [scanning, setScanning] = useState(false);
    
    // Modal & Form States
    const [modalOpen, setModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({});
    const [payForm, setPayForm] = useState({ customerId: '', customerName: '', amount: '', walletId: '' });
    const [processingPay, setProcessingPay] = useState(false);

    useEffect(() => { fetchData(); }, []);

    // 1. DATA FETCHING
    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            // A. Customers (Cache-first)
            let dataCustomers = null;
            if (!forceRefresh && typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_DURATION) dataCustomers = data;
                }
            }

            if (!dataCustomers) {
                const q = query(collection(db, "customers"), orderBy("name", "asc"), limit(200));
                const snap = await getDocs(q);
                dataCustomers = snap.docs.map(d => ({id: d.id, ...d.data()}));
                if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify({ data: dataCustomers, timestamp: Date.now() }));
            }
            setCustomers(dataCustomers);

            // B. Piutang (Real-time)
            const debtQuery = query(collection(db, "sales_orders"), where("payment_status", "==", "unpaid"));
            const debtSnap = await getDocs(debtQuery);
            const debts = {};
            debtSnap.forEach(d => {
                const so = d.data();
                if (so.customer_id) {
                    const total = so.financial?.total_sales ?? so.gross_amount ?? 0;
                    const paid = so.amount_paid || 0;
                    const remaining = total - paid;
                    if (remaining > 0) debts[so.customer_id] = (debts[so.customer_id] || 0) + remaining;
                }
            });
            setDebtMap(debts);

            // C. Wallets
            const walletSnap = await getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")));
            const wList = walletSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(a => String(a.code).startsWith('1') && (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank')));
            setWallets(wList);

        } catch (e) { console.error(e); toast.error("Gagal memuat data"); } 
        finally { setLoading(false); }
    };

    // 2. SCAN LOGIC
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
                        if (!newCandidates[key]) newCandidates[key] = { name, phone, address: s.shipping_address || s.buyer_address || '', type: 'end_customer' };
                    }
                });

                const existingPhones = new Set(customers.map(c => c.phone));
                const existingNames = new Set(customers.map(c => c.name.toLowerCase()));
                const finalToAdd = Object.values(newCandidates).filter(c => {
                    return !(c.phone && existingPhones.has(c.phone)) && !existingNames.has(c.name.toLowerCase());
                });

                if (finalToAdd.length === 0) resolve("Tidak ditemukan pelanggan baru.");
                else {
                    const batch = writeBatch(db);
                    finalToAdd.slice(0, 400).forEach(c => batch.set(doc(collection(db, "customers")), { ...c, created_at: serverTimestamp(), source: 'auto_scan' }));
                    await batch.commit();
                    if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                    fetchData(true);
                    resolve(`Disimpan: ${finalToAdd.slice(0, 400).length} pelanggan baru!`);
                }
            } catch (e) { reject(e); } finally { setScanning(false); }
        });
        toast.promise(scanPromise, { loading: 'Scanning...', success: (msg) => msg, error: (err) => `Gagal: ${err.message}` });
    };

    // 3. CRUD ACTIONS
    const openModal = (cust = null) => {
        setFormData(cust ? { ...cust } : { name: '', type: 'end_customer', phone: '', address: '' });
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if(!formData.name) return toast.error("Nama wajib diisi");
        const tId = toast.loading("Menyimpan...");
        try {
            const payload = { name: formData.name, type: formData.type, phone: formData.phone, address: formData.address, updated_at: serverTimestamp() };
            if (formData.id) await updateDoc(doc(db, "customers", formData.id), payload);
            else { payload.created_at = serverTimestamp(); await addDoc(collection(db, "customers"), payload); }
            
            if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
            setModalOpen(false); fetchData(true);
            toast.success("Berhasil disimpan", { id: tId });
        } catch (e) { toast.error(e.message, { id: tId }); }
    };

    const deleteItem = async (id) => {
        if(confirm("Hapus pelanggan?")) { 
            try {
                await deleteDoc(doc(db, "customers", id)); 
                if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
                fetchData(true); toast.success("Dihapus");
            } catch(e) { toast.error("Gagal menghapus"); }
        }
    };

    // 4. PAYMENT ACTIONS
    const openPayment = (cust) => {
        setPayForm({ customerId: cust.id, customerName: cust.name, amount: debtMap[cust.id] || '', walletId: wallets[0]?.id || '' });
        setPaymentModalOpen(true);
    };

    const handlePaymentSubmit = async () => {
        const amountToPay = parseFloat(payForm.amount);
        if(!amountToPay || amountToPay <= 0) return toast.error("Nominal tidak valid");
        if(!payForm.walletId) return toast.error("Pilih akun kas");

        setProcessingPay(true);
        const tId = toast.loading("Processing Payment...");
        try {
            const batch = writeBatch(db);
            const settingSnap = await getDoc(doc(db, "settings", "general"));
            const financeConfig = settingSnap.exists() ? settingSnap.data().financeConfig : {};
            const arAccountId = financeConfig.defaultReceivableId || '1201';

            const qSO = query(collection(db, "sales_orders"), where("customer_id", "==", payForm.customerId), where("payment_status", "==", "unpaid"), orderBy("order_date", "asc"));
            const soSnap = await getDocs(qSO);

            let remaining = amountToPay;
            const paidSOIds = [];

            soSnap.docs.forEach(docSnap => {
                if (remaining <= 0) return;
                const so = docSnap.data();
                const soRef = doc(db, "sales_orders", docSnap.id);
                const total = so.financial?.total_sales ?? so.gross_amount ?? 0;
                const debt = total - (so.amount_paid || 0);
                
                let pay = (remaining >= debt) ? debt : remaining;
                remaining -= pay;
                
                batch.update(soRef, { 
                    payment_status: (so.amount_paid + pay) >= total ? 'paid' : 'partial', 
                    amount_paid: (so.amount_paid || 0) + pay 
                });
                paidSOIds.push(docSnap.id);
            });

            if (remaining > 0) toast("Info: Ada kelebihan bayar (Deposit).", { icon: 'ℹ️' });

            recordTransaction(db, batch, {
                type: 'in', amount: amountToPay, walletId: payForm.walletId, 
                categoryId: arAccountId, categoryName: 'Pelunasan Piutang',
                description: `Terima Bayar ${payForm.customerName}`,
                refType: 'bulk_receivable_payment', refId: paidSOIds.join(','), userEmail: 'admin'
            });

            await batch.commit();
            localStorage.removeItem('lumina_sales_history_v2'); 
            localStorage.removeItem('lumina_cash_transactions_v2');
            
            toast.success("Pembayaran Diterima!", { id: tId });
            setPaymentModalOpen(false); fetchData(true); 
        } catch (e) { console.error(e); toast.error(e.message, { id: tId }); } 
        finally { setProcessingPay(false); }
    };

    const filteredData = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm)));

    return (
        <div className="max-w-full mx-auto space-y-6 fade-in pb-20 px-4 md:px-8 pt-6 bg-background min-h-screen text-text-primary">
            <PageHeader title="Customers CRM" subtitle="Database pelanggan dan manajemen piutang." actions={
                <div className="flex gap-3">
                    <button onClick={scanFromSales} disabled={scanning} className="btn-ghost-dark text-xs flex items-center gap-2 border-border bg-white shadow-sm"><ScanLine className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />{scanning ? 'Scanning...' : 'Scan Sales'}</button>
                    <button onClick={() => openModal()} className="btn-gold inline-flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-lg hover:shadow-xl"><Plus className="w-4 h-4 stroke-[2.5]" /><span>New Customer</span></button>
                </div>
            }/>

            {/* Total Piutang Card */}
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm"><Wallet className="w-6 h-6"/></div>
                    <div><p className="text-xs font-bold text-blue-800 uppercase">Total Piutang Pelanggan</p><h3 className="text-xl font-bold text-blue-600">{formatRupiah(Object.values(debtMap).reduce((a,b)=>a+b, 0))}</h3></div>
                </div>
            </div>

            {/* SEARCH */}
            <div className="relative max-w-md group">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 group-focus-within:text-primary transition-colors" />
                <input type="text" placeholder="Cari nama atau nomor HP..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-luxury pl-10 py-2.5"/>
            </div>

            {/* VIEWS */}
            <CustomerTable customers={filteredData} debtMap={debtMap} loading={loading} onEdit={openModal} onDelete={deleteItem} onReceivePayment={openPayment} />
            <CustomerCardList customers={filteredData} debtMap={debtMap} loading={loading} onEdit={openModal} onDelete={deleteItem} onReceivePayment={openPayment} />

            {/* MODALS */}
            <Portal>
                <CustomerFormModal isOpen={modalOpen} onClose={()=>setModalOpen(false)} onSubmit={handleSubmit} form={formData} setForm={setFormData} isEditing={!!formData.id} />
                <ReceivablePaymentModal isOpen={paymentModalOpen} onClose={()=>setPaymentModalOpen(false)} onSubmit={handlePaymentSubmit} form={payForm} setForm={setPayForm} wallets={wallets} debtAmount={debtMap[payForm.customerId]} loading={processingPay} />
            </Portal>
        </div>
    );
}