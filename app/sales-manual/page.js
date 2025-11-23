// app/sales-manual/page.js
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, runTransaction, addDoc, serverTimestamp, query, orderBy, where, limit } from 'firebase/firestore';
import { formatRupiah, sortBySize } from '@/lib/utils';
import { Portal } from '@/lib/usePortal';

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
                const wh = []; whS.forEach(d => wh.push({id:d.id, ...d.data()})); setWarehouses(wh);
                if(wh.length > 0) setSelectedWh(wh.find(w=>w.type!=='virtual_supplier')?.id || wh[0].id);
                const cust = []; custS.forEach(d => cust.push({id:d.id, ...d.data()})); setCustomers(cust);
                const acc = []; accS.forEach(d => { const c = d.data().category.toLowerCase(); if(c.includes('kas') || c.includes('bank')) acc.push({id:d.id, ...d.data()}); }); setAccounts(acc);
                const defAcc = acc.find(a => a.code === '1101' || a.code === '1201'); if(defAcc) setPaymentAccId(defAcc.id);
                const snaps = {}; snapS.forEach(d => snaps[d.id] = d.data().qty || 0); setSnapshots(snaps);
                const vars = []; varS.forEach(d => vars.push({id:d.id, ...d.data()}));
                const prods = []; prodS.forEach(d => { const p = d.data(); const pVars = vars.filter(v => v.product_id === d.id); prods.push({ id: d.id, ...p, variants: pVars }); });
                setProducts(prods);
            } catch(e) { console.error(e); } finally { setLoading(false); }
        };
        init();
    }, []);

    useEffect(() => {
        const handleKey = (e) => { if(e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); } if(e.key === 'F9') handleCheckout(); if(e.key === 'F8') setCart([]); };
        window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey);
    }, [cart, paymentAccId, cashReceived]); 

    const addToCart = (variant, prodName) => {
        const key = `${variant.id}_${selectedWh}`; const max = snapshots[key] || 0;
        if(max <= 0) return alert("Stok Habis!");
        const existIdx = cart.findIndex(i => i.id === variant.id);
        if(existIdx > -1) { const newCart = [...cart]; if(newCart[existIdx].qty + 1 > max) return alert("Stok Maksimal"); newCart[existIdx].qty += 1; setCart(newCart); }
        else { setCart([...cart, { id: variant.id, sku: variant.sku, name: prodName, spec: `${variant.color}/${variant.size}`, price: variant.price, cost: variant.cost, qty: 1, max }]); }
        setModalVariantOpen(false); setSearchTerm('');
    };

    const handleSearchEnter = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); const k = searchTerm.trim().toUpperCase(); if(!k) return; let fV=null, fP=null; for(const p of products) { const v = p.variants.find(x => x.sku===k || x.barcode===k); if(v) { fV=v; fP=p; break; } } if(fV) addToCart(fV, fP.name); }
    };

    const handleCheckout = async () => {
        if(cart.length === 0) return alert("Kosong");
        const total = cart.reduce((a,b) => a + (b.price * b.qty), 0); const received = parseInt(cashReceived) || 0;
        if(!confirm("Proses?")) return;
        try {
            const orderId = `ORD-${Date.now()}`;
            const custName = selectedCustId ? customers.find(c => c.id === selectedCustId).name : 'Guest';
            await runTransaction(db, async (t) => {
                const soRef = doc(collection(db, "sales_orders"));
                t.set(soRef, { order_number: orderId, warehouse_id: selectedWh, source: 'pos', customer_id: selectedCustId || null, customer_name: custName, order_date: serverTimestamp(), status: 'completed', payment_status: 'paid', gross_amount: total, net_amount: total, payment_account_id: paymentAccId, items_summary: cart.map(c => `${c.sku}(${c.qty})`).join(', '), created_by: auth.currentUser?.email });
                for(const i of cart) {
                    t.set(doc(collection(db, `sales_orders/${soRef.id}/items`)), { variant_id: i.id, sku: i.sku, qty: i.qty, unit_price: i.price, unit_cost: i.cost });
                    t.set(doc(collection(db, "stock_movements")), { variant_id: i.id, warehouse_id: selectedWh, type: 'sale_out', qty: -i.qty, ref_id: soRef.id, ref_type: 'sales_order', date: serverTimestamp() });
                    const sRef = doc(db, "stock_snapshots", `${i.id}_${selectedWh}`); const sDoc = await t.get(sRef); if(sDoc.exists()) t.update(sRef, { qty: sDoc.data().qty - i.qty });
                }
                t.set(doc(collection(db, "cash_transactions")), { type: 'in', amount: total, date: serverTimestamp(), category: 'penjualan', account_id: paymentAccId, description: `POS ${orderId}`, ref_type: 'sales_order', ref_id: soRef.id });
                const accRef = doc(db, "cash_accounts", paymentAccId); const accDoc = await t.get(accRef); if(accDoc.exists()) t.update(accRef, { balance: (accDoc.data().balance || 0) + total });
            });
            setInvoiceData({ id: orderId, total, received, change: received - total, items: cart, date: new Date(), customer: custName }); setModalInvoiceOpen(true); setCart([]); setCashReceived('');
        } catch(e) { alert(e.message); }
    };

    const handlePrint = () => { window.print(); };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.base_sku?.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 24);
    const cartTotal = cart.reduce((a,b) => a + (b.price * b.qty), 0);
    const change = (parseInt(cashReceived) || 0) - cartTotal;

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)] fade-in relative">
            
            {/* HIDDEN RECEIPT (Hanya Muncul Saat Print) */}
            <div id="receipt-print-area" className="hidden bg-white text-black font-mono text-xs p-2 max-w-[300px]">
                <div className="text-center mb-4"><h2 className="text-sm font-bold uppercase">BOBING STORE</h2><p>Jl. Contoh No. 123, Kota</p></div>
                <div className="border-b border-black border-dashed mb-2"></div>
                <div className="flex justify-between mb-2"><span>{invoiceData?.id}</span><span>{invoiceData?.date?.toLocaleDateString()}</span></div>
                <div className="mb-2">Cust: {invoiceData?.customer}</div>
                <div className="border-b border-black border-dashed mb-2"></div>
                {invoiceData?.items.map((item, i) => (
                    <div key={i} className="mb-2"><div>{item.name} ({item.spec})</div><div className="flex justify-between"><span>{item.qty} x {parseInt(item.price).toLocaleString()}</span><span>{(item.qty * item.price).toLocaleString()}</span></div></div>
                ))}
                <div className="border-b border-black border-dashed my-2"></div>
                <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>Rp {invoiceData?.total?.toLocaleString()}</span></div>
                <div className="flex justify-between mt-1"><span>Tunai</span><span>Rp {invoiceData?.received?.toLocaleString()}</span></div>
                <div className="flex justify-between mt-1"><span>Kembali</span><span>Rp {invoiceData?.change?.toLocaleString()}</span></div>
            </div>

            {/* LEFT: PRODUCTS */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4 h-full">
                <div className="card-luxury p-4 flex gap-3 items-center shrink-0">
                    <div className="relative flex-1"><input ref={searchInputRef} type="text" className="input-luxury pl-10" placeholder="Scan Barcode (F2)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleSearchEnter} autoFocus /></div>
                    <select className="input-luxury w-48" value={selectedWh} onChange={e=>setSelectedWh(e.target.value)}>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                    {loading ? <div className="col-span-full text-center py-10 text-lumina-muted">Loading...</div> : filteredProducts.map(p => {
                        const stock = p.variants.reduce((a,b) => a + (snapshots[`${b.id}_${selectedWh}`] || 0), 0);
                        return (
                            <div key={p.id} onClick={() => { setSelectedProdForVariant(p); setModalVariantOpen(true); }} className={`card-luxury p-4 cursor-pointer hover:border-lumina-gold/50 transition-all flex flex-col justify-between group ${stock<=0?'opacity-50':''}`}>
                                <div><div className="flex justify-between mb-2"><span className="text-[10px] font-mono font-bold text-lumina-muted bg-lumina-base px-1.5 rounded">{p.base_sku}</span><span className={`text-[10px] px-2 rounded ${stock>0?'text-emerald-400 bg-emerald-900/30':'text-rose-400 bg-rose-900/30'}`}>{stock}</span></div><h4 className="text-sm font-bold text-lumina-text group-hover:text-lumina-gold line-clamp-2">{p.name}</h4></div>
                                <div className="mt-3 pt-3 border-t border-lumina-border text-[10px] text-lumina-muted text-right">{p.variants.length} Variants</div>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            {/* RIGHT: CART */}
            <div className="w-full lg:w-1/3 card-luxury flex flex-col h-full overflow-hidden border-lumina-border">
                <div className="p-4 border-b border-lumina-border bg-lumina-surface flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lumina-text">Cart ({cart.length})</h3>
                    <button onClick={()=>setCart([])} className="text-xs text-rose-400 hover:text-white border border-rose-500/30 px-2 py-1 rounded">CLEAR (F8)</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-lumina-base">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-lumina-border pb-2 last:border-0">
                            <div className="flex-1 mr-2"><div className="text-sm font-medium text-lumina-text">{item.name}</div><div className="text-xs text-lumina-muted">{item.sku} • <span className="text-lumina-gold">{item.spec}</span></div><div className="text-xs font-bold text-lumina-text mt-0.5">{formatRupiah(item.price)}</div></div>
                            <div className="flex items-center bg-lumina-surface rounded border border-lumina-border"><button onClick={() => { const n = [...cart]; if(n[idx].qty > 1) n[idx].qty--; else n.splice(idx, 1); setCart(n); }} className="px-2 text-lumina-muted hover:text-white">-</button><span className="text-sm font-bold w-6 text-center text-lumina-text">{item.qty}</span><button onClick={() => { if(item.qty < item.max) { const n = [...cart]; n[idx].qty++; setCart(n); } }} className="px-2 text-lumina-muted hover:text-white">+</button></div>
                        </div>
                    ))}
                </div>
                <div className="p-5 border-t border-lumina-border bg-lumina-surface space-y-3 shrink-0">
                    <div className="grid grid-cols-2 gap-2"><select className="input-luxury py-1.5 text-xs" value={selectedCustId} onChange={e=>setSelectedCustId(e.target.value)}><option value="">Customer (Guest)</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="input-luxury py-1.5 text-xs" value={paymentAccId} onChange={e=>setPaymentAccId(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div className="flex justify-between pt-2"><span className="text-lumina-muted">Total</span><span className="text-2xl font-bold text-lumina-gold">{formatRupiah(cartTotal)}</span></div>
                    <div className="flex justify-between items-center bg-lumina-base p-2 rounded border border-lumina-border"><span className="text-xs text-lumina-muted">Cash</span><input type="number" className="text-right font-bold text-lumina-text bg-transparent outline-none w-32" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder="0" /></div>
                    <div className="flex justify-between"><span className="text-xs text-lumina-muted">Change</span><span className={`text-sm font-bold ${change<0?'text-rose-500':'text-emerald-500'}`}>{formatRupiah(Math.max(0,change))}</span></div>
                    <button onClick={handleCheckout} className="btn-gold w-full py-3">PAY (F9)</button>
                </div>
            </div>

            {/* MODAL VARIANT */}
            <Portal>
            {modalVariantOpen && selectedProdForVariant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="card-luxury w-full max-w-lg p-0 overflow-hidden fade-in-up">
                        <div className="p-4 border-b border-lumina-border bg-lumina-surface flex justify-between"><h3 className="font-bold text-lumina-text">{selectedProdForVariant.name}</h3><button onClick={()=>setModalVariantOpen(false)} className="text-lumina-muted">✕</button></div>
                        <div className="max-h-[50vh] overflow-y-auto"><table className="table-dark"><tbody>{selectedProdForVariant.variants.sort(sortBySize).map(v => { const qty = snapshots[`${v.id}_${selectedWh}`] || 0; return <tr key={v.id}><td className="pl-4 py-3 font-medium">{v.color}/{v.size}</td><td className="text-right">{formatRupiah(v.price)}</td><td className="text-center">{qty}</td><td className="pr-4 text-right"><button disabled={qty<=0} onClick={()=>addToCart(v, selectedProdForVariant.name)} className={`px-3 py-1 rounded text-xs font-bold ${qty>0?'bg-lumina-gold text-black':'bg-lumina-highlight text-lumina-muted'}`}>+ Add</button></td></tr> })}</tbody></table></div>
                    </div>
                </div>
            )}
            </Portal>

            {/* MODAL SUCCESS */}
            <Portal>
            {modalInvoiceOpen && invoiceData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="card-luxury max-w-sm w-full p-8 text-center relative overflow-hidden fade-in-up border-lumina-gold/50">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h2 className="text-2xl font-extrabold text-white">Transaksi Sukses!</h2>
                        <div className="bg-lumina-base p-5 rounded-2xl border border-lumina-border space-y-3 mt-6">
                            <div className="flex justify-between text-sm"><span className="text-lumina-muted">Total</span><span className="font-bold text-white">{formatRupiah(invoiceData.total)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-lumina-muted">Tunai</span><span className="font-bold text-white">{formatRupiah(invoiceData.received)}</span></div>
                            <div className="border-t border-lumina-border my-2"></div>
                            <div className="flex justify-between items-center"><span className="text-sm font-bold text-emerald-400">Kembali</span><span className="text-xl font-extrabold text-emerald-400">{formatRupiah(Math.max(0, invoiceData.change))}</span></div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={handlePrint} className="flex-1 btn-ghost-dark py-3 flex items-center justify-center gap-2">Print Struk</button>
                            <button onClick={()=>setModalInvoiceOpen(false)} className="flex-1 btn-gold py-3">New Order</button>
                        </div>
                    </div>
                </div>
            )}
            </Portal>
        </div>
    );
}