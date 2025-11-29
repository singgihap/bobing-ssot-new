// app/(dashboard)/purchases/[id]/page.js
"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, runTransaction, serverTimestamp, increment } from 'firebase/firestore';
import { formatRupiah } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function PurchaseDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    
    const [po, setPo] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // State untuk Modal Payment
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [payAmount, setPayAmount] = useState('');

    useEffect(() => {
        if(id) fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            const docSnap = await getDoc(doc(db, "purchase_orders", id));
            if(!docSnap.exists()) return toast.error("PO tidak ditemukan");
            
            setPo({ id: docSnap.id, ...docSnap.data() });

            // Fetch Items
            const itemsSnap = await getDocs(collection(db, `purchase_orders/${id}/items`));
            const itemsData = [];
            itemsSnap.forEach(d => itemsData.push({ id: d.id, ...d.data() }));
            setItems(itemsData);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- LOGIC 1: RECEIVE GOODS (Update Stok) ---
    const handleReceiveGoods = async () => {
        if(!confirm("Pastikan fisik barang sudah diterima di gudang. Lanjutkan?")) return;
        
        const tId = toast.loading("Processing Stock In...");
        try {
            await runTransaction(db, async (t) => {
                const poRef = doc(db, "purchase_orders", id);
                const poDoc = await t.get(poRef);
                if(poDoc.data().fulfillment_status === 'RECEIVED') throw new Error("PO ini sudah diterima sebelumnya!");

                // 1. Update Stok per Item
                for(const item of items) {
                    // History Pergerakan Stok
                    const moveRef = doc(collection(db, "stock_movements"));
                    t.set(moveRef, {
                        variant_id: item.variant_id,
                        warehouse_id: po.warehouse_id, // Ambil dari Header PO
                        type: 'purchase_in',
                        qty: item.qty_ordered, // Asumsi terima full
                        ref_id: id,
                        ref_type: 'purchase_order',
                        date: serverTimestamp(),
                        notes: `Received from PO ${po.po_number || 'Old'}`
                    });

                    // Update Snapshot (Atomic Increment)
                    const snapId = `${item.variant_id}_${po.warehouse_id}`;
                    const snapRef = doc(db, "stock_snapshots", snapId);
                    t.set(snapRef, { 
                        id: snapId,
                        variant_id: item.variant_id,
                        warehouse_id: po.warehouse_id,
                        qty: increment(item.qty_ordered) // Nambah stok otomatis
                    }, { merge: true });
                }

                // 2. Update Status PO
                t.update(poRef, {
                    fulfillment_status: 'RECEIVED',
                    received_date: serverTimestamp()
                });
            });

            toast.success("Stok Berhasil Masuk!", { id: tId });
            fetchDetail(); // Refresh UI
            
            // Invalidate Cache Stok Dashboard
            if(typeof window !== 'undefined') {
                 localStorage.removeItem('lumina_inventory_v2');
                 localStorage.removeItem('lumina_purchases_history_v2');
            }

        } catch(e) {
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: tId });
        }
    };

    // --- LOGIC 2: PAYMENT (Update Finance) ---
    const handlePayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(payAmount);
        if(!amount || amount <= 0) return toast.error("Nominal tidak valid");

        const tId = toast.loading("Mencatat Pembayaran...");
        try {
            await runTransaction(db, async (t) => {
                const poRef = doc(db, "purchase_orders", id);
                const poDoc = await t.get(poRef);
                
                const currentPaid = poDoc.data().amount_paid || 0;
                const total = poDoc.data().total_amount;
                const newPaid = currentPaid + amount;
                
                // Cek Status Pembayaran Baru
                let newStatus = 'PARTIAL_PAID';
                if(newPaid >= total) newStatus = 'PAID';
                if(newPaid <= 0) newStatus = 'UNPAID';

                // 1. Catat di Cash Transaction (Uang Keluar)
                const cashRef = doc(collection(db, "cash_transactions"));
                t.set(cashRef, {
                    type: 'out', // Expense
                    amount: amount,
                    category: 'pembelian',
                    ref_id: id,
                    ref_type: 'purchase_order',
                    description: `Pembayaran PO ${poDoc.data().supplier_name}`,
                    date: serverTimestamp(),
                    created_by: user?.email
                });

                // 2. Catat Log Pembayaran Spesifik PO
                const payLogRef = doc(collection(db, "purchase_payments"));
                t.set(payLogRef, {
                    po_id: id,
                    amount: amount,
                    date: serverTimestamp(),
                    recorder: user?.email
                });

                // 3. Update Header PO
                t.update(poRef, {
                    amount_paid: newPaid,
                    payment_status: newStatus,
                    updated_at: serverTimestamp()
                });
            });

            toast.success("Pembayaran Tercatat!", { id: tId });
            setPayModalOpen(false);
            setPayAmount('');
            fetchDetail();
            
            // Invalidate Cache Finance
            if(typeof window !== 'undefined') {
                localStorage.removeItem('lumina_purchases_history_v2');
            }

        } catch(e) {
            toast.error(`Gagal: ${e.message}`, { id: tId });
        }
    };

    if (loading || !po) return <div className="p-8 text-center text-text-secondary">Loading Order Details...</div>;

    const outstanding = po.total_amount - (po.amount_paid || 0);

    return (
        <div className="max-w-5xl mx-auto pb-20 space-y-6 fade-in">
            {/* Header Nav */}
            <div className="flex items-center gap-4 mb-4">
                <Link href="/purchases/overview" className="btn-ghost-dark">&larr; Back</Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-text-primary">PO #{po.po_number || po.id.substring(0,8)}</h1>
                    <p className="text-text-secondary text-sm">Created on {new Date(po.order_date?.toDate()).toLocaleDateString()}</p>
                </div>
            </div>

            {/* STATUS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Fulfillment Card */}
                <div className="card-luxury p-6 border-l-4 border-l-blue-500">
                    <h3 className="text-sm font-bold text-text-secondary uppercase mb-2">Fulfillment Status</h3>
                    <div className="flex justify-between items-center">
                        <span className={`text-2xl font-bold ${po.fulfillment_status === 'RECEIVED' ? 'text-emerald-400' : 'text-blue-400'}`}>
                            {po.fulfillment_status || 'OPEN'}
                        </span>
                        {po.fulfillment_status !== 'RECEIVED' && (
                            <button onClick={handleReceiveGoods} className="btn-gold text-xs">
                                &#10003; Mark Received (Stock In)
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-text-secondary mt-2">
                        {po.fulfillment_status === 'RECEIVED' 
                            ? `Received on ${po.received_date ? new Date(po.received_date.toDate()).toLocaleDateString() : '-'}`
                            : "Barang belum masuk stok gudang."}
                    </p>
                </div>

                {/* 2. Payment Card */}
                <div className="card-luxury p-6 border-l-4 border-l-amber-500">
                    <h3 className="text-sm font-bold text-text-secondary uppercase mb-2">Payment Status</h3>
                    <div className="flex justify-between items-center">
                        <div>
                             <span className={`text-2xl font-bold ${po.payment_status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {po.payment_status || 'UNPAID'}
                            </span>
                            <div className="text-xs text-text-secondary mt-1">
                                Paid: {formatRupiah(po.amount_paid || 0)} / Total: {formatRupiah(po.total_amount)}
                            </div>
                        </div>
                        {po.payment_status !== 'PAID' && (
                            <button onClick={()=>setPayModalOpen(true)} className="btn-ghost-dark border border-lumina-border text-xs">
                                + Add Payment
                            </button>
                        )}
                    </div>
                    {outstanding > 0 && <p className="text-xs text-rose-400 mt-2 font-bold">Outstanding: {formatRupiah(outstanding)}</p>}
                </div>
            </div>

            {/* ITEMS TABLE */}
            <div className="card-luxury overflow-hidden">
                <div className="p-4 border-b border-lumina-border bg-surface/50">
                    <h3 className="font-bold text-text-primary">Order Items</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-text-primary">
                        <thead className="bg-background text-text-secondary uppercase text-xs">
                            <tr>
                                <th className="p-4">Product</th>
                                <th className="p-4 text-right">Qty</th>
                                <th className="p-4 text-right">Cost</th>
                                <th className="p-4 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-lumina-border">
                            {items.map((item) => (
                                <tr key={item.id}>
                                    <td className="p-4">
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-xs text-text-secondary">{item.sku}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono">{item.qty_ordered}</td>
                                    <td className="p-4 text-right font-mono">{formatRupiah(item.unit_cost)}</td>
                                    <td className="p-4 text-right font-mono text-lumina-gold">{formatRupiah(item.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-surface/30 font-bold">
                            <tr>
                                <td colSpan="3" className="p-4 text-right text-text-secondary">Grand Total</td>
                                <td className="p-4 text-right text-xl text-lumina-gold">{formatRupiah(po.total_amount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* MODAL PAYMENT */}
            {payModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="card-luxury w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-text-primary mb-4">Record Payment</h3>
                        <form onSubmit={handlePayment} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-text-secondary block mb-1">Amount (IDR)</label>
                                <input 
                                    type="number" 
                                    autoFocus
                                    className="input-luxury w-full text-lg" 
                                    value={payAmount}
                                    onChange={e=>setPayAmount(e.target.value)}
                                    placeholder={outstanding}
                                    max={outstanding} 
                                />
                                <p className="text-xs text-text-secondary mt-1">Max: {formatRupiah(outstanding)}</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={()=>setPayModalOpen(false)} className="btn-ghost-dark">Cancel</button>
                                <button type="submit" className="btn-gold">Confirm Payment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}