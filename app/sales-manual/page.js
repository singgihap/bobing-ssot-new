// app/sales-manual/page.js
"use client";
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, addDoc, serverTimestamp, query, orderBy, where, limit } from 'firebase/firestore';
import { formatRupiah, sortBySize } from '@/lib/utils';

export default function PosPage() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [snapshots, setSnapshots] = useState({});
    const [selectedWh, setSelectedWh] = useState('');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [cashReceived, setCashReceived] = useState('');
    
    // Modals
    const [modalVariantOpen, setModalVariantOpen] = useState(false);
    const [selectedProdForVariant, setSelectedProdForVariant] = useState(null);
    const [modalInvoiceOpen, setModalInvoiceOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    const [paymentAccId, setPaymentAccId] = useState('');
    const [selectedCustId, setSelectedCustId] = useState('');

    const searchInputRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            try {
                const [whS, prodS, varS, custS, snapS, accS] = await Promise.all([
                    getDocs(query(collection(db, "warehouses"), orderBy("created_at"))),
                    getDocs(collection(db, "products")),
                    getDocs(query(collection(db, "product_variants"), orderBy("sku"))),
                    getDocs(query(collection(db, "customers"), orderBy("name"))),
                    getDocs(collection(db, "stock_snapshots")),
                    getDocs(query(collection(db, "chart_of_accounts"), orderBy("code")))
                ]);

                const wh = []; whS.forEach(d => wh.push({id:d.id, ...d.data()}));
                setWarehouses(wh);
                if(wh.length > 0) setSelectedWh(wh.find(w=>w.type!=='virtual_supplier')?.id || wh[0].id);

                const cust = []; custS.forEach(d => cust.push({id:d.id, ...d.data()}));
                setCustomers(cust);

                const acc = []; accS.forEach(d => {
                    const c = d.data().category.toLowerCase();
                    if(c.includes('kas') || c.includes('bank')) acc.push({id:d.id, ...d.data()});
                });
                setAccounts(acc);
                const defAcc = acc.find(a => a.code === '1101' || a.code === '1201'); 
                if(defAcc) setPaymentAccId(defAcc.id);

                const snaps = {}; snapS.forEach(d => snaps[d.id] = d.data().qty || 0);
                setSnapshots(snaps);

                const vars = []; varS.forEach(d => vars.push({id:d.id, ...d.data()}));
                const prods = []; 
                prodS.forEach(d => {
                    const p = d.data();
                    const pVars = vars.filter(v => v.product_id === d.id);
                    prods.push({ id: d.id, ...p, variants: pVars });
                });
                setProducts(prods);

            } catch(e) { console.error(e); } finally { setLoading(false); }
        };
        init();
    }, []);

    useEffect(() => {
        const handleKey = (e) => {
            if(e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
            if(e.key === 'F9') handleCheckout();
            if(e.key === 'F8') setCart([]);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [cart, paymentAccId, cashReceived]); 

    const addToCart = (variant, prodName) => {
        const key = `${variant.id}_${selectedWh}`;
        const max = snapshots[key] || 0;
        
        if(max <= 0) return alert("Stok Habis!");

        const existIdx = cart.findIndex(i => i.id === variant.id);
        if(existIdx > -1) {
            const newCart = [...cart];
            if(newCart[existIdx].qty + 1 > max) return alert("Stok Maksimal Tercapai");
            newCart[existIdx].qty += 1;
            setCart(newCart);
        } else {
            setCart([...cart, {
                id: variant.id, sku: variant.sku, name: prodName, 
                spec: `${variant.color}/${variant.size}`, 
                price: variant.price, cost: variant.cost, qty: 1, max
            }]);
        }
        setModalVariantOpen(false);
        setSearchTerm('');
    };

    const handleSearchEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const keyword = searchTerm.trim().toUpperCase();
            if(!keyword) return;
            let foundVar = null; let foundProd = null;
            for(const p of products) {
                const v = p.variants.find(v => v.sku === keyword || v.barcode === keyword);
                if(v) { foundVar = v; foundProd = p; break; }
            }
            if(foundVar) { addToCart(foundVar, foundProd.name); }
        }
    };

    const handleCheckout = async () => {
        if(cart.length === 0) return alert("Keranjang kosong");
        if(!paymentAccId) return alert("Pilih metode pembayaran");
        const total = cart.reduce((a,b) => a + (b.price * b.qty), 0);
        const received = parseInt(cashReceived) || 0;
        if(!confirm("Proses Transaksi?")) return;

        try {
            const orderId = `ORD-${Date.now()}`;
            const custName = selectedCustId ? customers.find(c => c.id === selectedCustId).name : 'Guest';
            const accName = accounts.find(a => a.id === paymentAccId)?.name;

            await runTransaction(db, async (t) => {
                const soRef = doc(collection(db, "sales_orders"));
                t.set(soRef, {
                    order_number: orderId, warehouse_id: selectedWh, source: 'pos_manual',
                    customer_id: selectedCustId || null, customer_name: custName,
                    order_date: serverTimestamp(), status: 'completed', payment_status: 'paid',
                    gross_amount: total, net_amount: total, 
                    payment_method: accName, payment_account_id: paymentAccId,
                    items_summary: cart.map(c => `${c.sku}(${c.qty})`).join(', '),
                    created_by: auth.currentUser?.email
                });

                for(const item of cart) {
                    const itemRef = doc(collection(db, `sales_orders/${soRef.id}/items`));
                    t.set(itemRef, { variant_id: item.id, sku: item.sku, qty: item.qty, unit_price: item.price, unit_cost: item.cost });
                    const moveRef = doc(collection(db, "stock_movements"));
                    t.set(moveRef, {
                        variant_id: item.id, warehouse_id: selectedWh, type: 'sale_out',
                        qty: -item.qty, ref_id: soRef.id, ref_type: 'sales_order',
                        date: serverTimestamp(), notes: `POS ${orderId}`
                    });
                    const snapRef = doc(db, "stock_snapshots", `${item.id}_${selectedWh}`);
                    const snapDoc = await t.get(snapRef);
                    if(snapDoc.exists()) t.update(snapRef, { qty: snapDoc.data().qty - item.qty });
                }

                const cashRef = doc(collection(db, "cash_transactions"));
                t.set(cashRef, {
                    type: 'in', amount: total, date: serverTimestamp(), category: 'penjualan',
                    account_id: paymentAccId, description: `Sales POS ${orderId}`, ref_type: 'sales_order', ref_id: soRef.id
                });

                const accRef = doc(db, "cash_accounts", paymentAccId);
                const accDoc = await t.get(accRef);
                if(accDoc.exists()) t.update(accRef, { balance: (accDoc.data().balance || 0) + total });
            });

            setInvoiceData({ id: orderId, date: new Date().toLocaleString(), customer: custName, items: cart, total, received, change: received - total });
            setModalInvoiceOpen(true);
            setCart([]); setCashReceived(''); setSearchTerm('');
        } catch(e) { alert(e.message); }
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.base_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.variants.some(v => v.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 24);

    const cartTotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const change = (parseInt(cashReceived) || 0) - cartTotal;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)] fade-in">            
            {/* LEFT: PRODUCT LIST */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4 h-full">
                <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center shrink-0">
                    <div className="relative flex-1 w-full">
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            className="input-field pl-10" 
                            placeholder="Scan Barcode (F2)..." 
                            autoFocus
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchEnter}
                        />
                    </div>
                    <select className="select-field w-full sm:w-48 font-bold" value={selectedWh} onChange={e=>setSelectedWh(e.target.value)}>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                    {loading ? <div className="col-span-full text-center py-10 text-gray-400">Loading Catalog...</div> : filteredProducts.map(p => {
                        const totalStock = p.variants.reduce((a,b) => a + (snapshots[`${b.id}_${selectedWh}`] || 0), 0);
                        return (
                            <div key={p.id} onClick={() => { setSelectedProdForVariant(p); setModalVariantOpen(true); }} 
                                className={`bg-white border border-slate-200 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md group flex flex-col justify-between ${totalStock <= 0 ? 'opacity-60 grayscale' : ''}`}>
                                <div className="mb-2">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{p.base_sku}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${totalStock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                            {totalStock > 0 ? `${totalStock}` : '0'}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 line-clamp-2 mt-1 group-hover:text-brand-600">{p.name}</h4>
                                </div>
                                <div className="text-xs text-slate-500 text-right">{p.variants.length} Varian</div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* RIGHT: CART */}
            <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                        Current Order
                    </h3>
                    <button onClick={()=>setCart([])} className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded">CLEAR (F8)</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                    {cart.length===0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                            <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                            <p className="text-sm font-medium">Keranjang Kosong</p>
                        </div>
                    ) : cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0">
                            <div className="flex-1 min-w-0 mr-3">
                                <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
                                <div className="text-xs text-slate-500 font-mono">{item.sku} • <span className="text-brand-600">{item.spec}</span></div>
                                <div className="text-xs font-bold text-slate-700 mt-0.5">{formatRupiah(item.price)}</div>
                            </div>
                            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                <button onClick={() => {
                                    const newCart = [...cart]; if(newCart[idx].qty > 1) newCart[idx].qty--; else newCart.splice(idx, 1); setCart(newCart);
                                }} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-red-500 rounded-md transition shadow-sm font-bold">-</button>
                                <span className="text-sm font-bold w-8 text-center text-slate-800">{item.qty}</span>
                                <button onClick={() => {
                                    if(item.qty < item.max) { const newCart = [...cart]; newCart[idx].qty++; setCart(newCart); } else alert("Stok max");
                                }} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-green-600 rounded-md transition shadow-sm font-bold">+</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0">
                    <div className="grid grid-cols-2 gap-3">
                        <select className="select-field py-1.5 text-xs" value={selectedCustId} onChange={e=>setSelectedCustId(e.target.value)}>
                            <option value="">Customer (Guest)</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="select-field py-1.5 text-xs font-bold text-brand-700" value={paymentAccId} onChange={e=>setPaymentAccId(e.target.value)}>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-400 uppercase">Total Tagihan</span>
                            <span className="text-2xl font-extrabold text-slate-800">{formatRupiah(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-500 ml-1">Tunai</span>
                            <input type="number" className="text-right font-bold text-slate-800 outline-none w-32 bg-transparent placeholder-slate-300" 
                                value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder="Rp 0" />
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span className="text-xs font-bold text-slate-400">Kembali</span>
                            <span className={`text-sm font-bold ${change < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatRupiah(Math.max(0, change))}</span>
                        </div>
                    </div>

                    <button onClick={handleCheckout} className="w-full btn-primary py-3.5 text-base shadow-brand-500/30">
                        BAYAR (F9)
                    </button>
                </div>
            </div>

            {/* MODAL VARIANT SELECT */}
            {modalVariantOpen && selectedProdForVariant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-0 overflow-hidden fade-in-up">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-900">{selectedProdForVariant.name}</h3>
                                <p className="text-xs text-gray-500 font-mono">{selectedProdForVariant.base_sku}</p>
                            </div>
                            <button onClick={()=>setModalVariantOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-0">
                            <table className="table-modern">
                                <thead className="bg-white"><tr><th className="pl-4 py-2">Varian</th><th className="text-right py-2">Harga</th><th className="text-center py-2">Stok</th><th className="text-center py-2 pr-4">Aksi</th></tr></thead>
                                <tbody>
                                    {selectedProdForVariant.variants.sort(sortBySize).map(v => {
                                        const qty = snapshots[`${v.id}_${selectedWh}`] || 0;
                                        return (
                                            <tr key={v.id} className="hover:bg-slate-50">
                                                <td className="pl-4 py-3 font-medium text-sm">{v.color} / {v.size}</td>
                                                <td className="text-right py-3 font-bold text-slate-700">{formatRupiah(v.price)}</td>
                                                <td className="text-center py-3">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${qty>0?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{qty}</span>
                                                </td>
                                                <td className="text-center py-3 pr-4">
                                                    <button disabled={qty<=0} onClick={()=>addToCart(v, selectedProdForVariant.name)} 
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${qty>0 ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                                        Add
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUCCESS */}
            {modalInvoiceOpen && invoiceData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center relative overflow-hidden fade-in-up">
                        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-100">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-800">Pembayaran Sukses!</h2>
                        <p className="text-sm text-slate-500 mt-1 mb-6 font-mono">{invoiceData.id}</p>
                        
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Total Tagihan</span>
                                <span className="font-bold text-slate-800">{formatRupiah(invoiceData.total)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Diterima</span>
                                <span className="font-bold text-slate-800">{formatRupiah(invoiceData.received)}</span>
                            </div>
                            <div className="border-t border-slate-200 my-2"></div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-emerald-600">Kembalian</span>
                                <span className="text-xl font-extrabold text-emerald-600">{formatRupiah(Math.max(0, invoiceData.change))}</span>
                            </div>
                        </div>

                        <button onClick={()=>setModalInvoiceOpen(false)} className="mt-6 w-full btn-primary py-3 shadow-none bg-slate-800 hover:bg-slate-900 text-white">
                            Transaksi Baru
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}