"use client";
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Building, Truck, Wallet, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function PurchaseOrderForm({ 
    isOpen, onClose, onSubmit, 
    suppliers, warehouses, products, variants, wallets,
    initialData, isEditing 
}) {
    // Local State untuk Form & Cart
    const [cart, setCart] = useState([]);
    const [formData, setFormData] = useState({
        supplier_id: '',
        warehouse_id: '',
        date: new Date().toISOString().split('T')[0],
        isPaid: false,
        wallet_id: ''
    });
    const [inputItem, setInputItem] = useState({ variant_id: '', qty: '', cost: '' });

    // Load Initial Data jika Edit Mode
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    supplier_id: initialData.supplier_id,
                    warehouse_id: initialData.warehouse_id,
                    date: initialData.date,
                    isPaid: initialData.isPaid,
                    wallet_id: initialData.wallet_id || ''
                });
                setCart(initialData.cart || []);
            } else {
                // Reset Form (New PO)
                setFormData({
                    supplier_id: '', warehouse_id: warehouses[0]?.id || '', 
                    date: new Date().toISOString().split('T')[0], isPaid: false, wallet_id: ''
                });
                setCart([]);
            }
            setInputItem({ variant_id: '', qty: '', cost: '' });
        }
    }, [isOpen, initialData, warehouses]);

    const addItem = () => {
        const { variant_id, qty, cost } = inputItem;
        if(!variant_id || !qty || !cost) return;
        
        const v = variants.find(x => x.id === variant_id);
        const p = products.find(x => x.id === v?.product_id);
        
        const newItem = { 
            variant_id, 
            sku: v.sku, 
            name: p?.name, 
            spec: `${v.color}/${v.size}`, 
            qty: parseInt(qty), 
            unit_cost: parseInt(cost) 
        };

        // Cek duplikasi di cart (Update qty/cost jika ada)
        const existIdx = cart.findIndex(c => c.variant_id === variant_id);
        if(existIdx >= 0) {
            const n = [...cart];
            n[existIdx] = newItem; // Replace dengan input baru
            setCart(n);
        } else {
            setCart([...cart, newItem]);
        }
        setInputItem({ ...inputItem, qty: '', cost: '' }); // Reset input angka, biarkan varian terpilih
    };

    const removeItem = (idx) => {
        setCart(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        onSubmit(formData, cart);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="text-lg font-bold text-text-primary">
                        {isEditing ? 'Edit Purchase Order' : 'New Purchase Order'}
                    </h3>
                    <button onClick={onClose} className="bg-white p-1.5 rounded-lg border border-border text-text-secondary hover:text-rose-500"><X className="w-5 h-5"/></button>
                </div>
                
                {isEditing && (
                    <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 flex gap-2 items-center text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4"/>
                        <span><b>Mode Edit:</b> Saldo dan stok akan dikoreksi otomatis (Revert & Re-apply).</span>
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-secondary uppercase">Supplier</label>
                            <div className="relative"><Building className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><select className="input-luxury pl-10" value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}><option value="">-- Select --</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-secondary uppercase">Warehouse</label>
                            <div className="relative"><Truck className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><select className="input-luxury pl-10" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}><option value="">-- Select --</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-secondary uppercase">Order Date</label>
                            <input type="date" className="input-luxury" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                    </div>

                    {/* Item Input */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-border space-y-3">
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-12 md:col-span-6">
                                <label className="text-xs font-bold text-text-secondary block mb-1">Product Variant</label>
                                <select className="input-luxury" value={inputItem.variant_id} onChange={e => { const v = variants.find(x=>x.id===e.target.value); setInputItem({...inputItem, variant_id: e.target.value, cost: v?.cost || ''}) }}><option value="">Search Item...</option>{variants.map(v => { const p = products.find(x=>x.id===v.product_id); return <option key={v.id} value={v.id}>{p?.name} ({v.color}/{v.size})</option> })}</select>
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="text-xs font-bold text-text-secondary block mb-1">Qty</label>
                                <input type="number" className="input-luxury" placeholder="0" value={inputItem.qty} onChange={e=>setInputItem({...inputItem, qty:e.target.value})} />
                            </div>
                            <div className="col-span-6 md:col-span-3">
                                <label className="text-xs font-bold text-text-secondary block mb-1">Cost (HPP)</label>
                                <input type="number" className="input-luxury" placeholder="Rp" value={inputItem.cost} onChange={e=>setInputItem({...inputItem, cost:e.target.value})} />
                            </div>
                            <div className="col-span-12 md:col-span-1 flex items-end">
                                <button type="button" onClick={addItem} className="btn-gold w-full h-10 flex items-center justify-center rounded-xl"><Plus className="w-5 h-5"/></button>
                            </div>
                        </div>
                    </div>

                    {/* Cart List */}
                    <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-text-secondary uppercase">
                                <tr><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Subtotal</th><th className="p-3 w-10"></th></tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {cart.map((c, idx) => (
                                    <tr key={idx}>
                                        <td className="p-3"><div className="font-bold text-text-primary">{c.name}</div><div className="text-xs text-text-secondary">{c.spec}</div></td>
                                        <td className="p-3 text-right font-mono">{c.qty}</td>
                                        <td className="p-3 text-right font-mono font-bold">{formatRupiah(c.qty*c.unit_cost)}</td>
                                        <td className="p-3 text-center"><button onClick={() => removeItem(idx)} className="text-rose-400 hover:text-rose-600"><X className="w-4 h-4"/></button></td>
                                    </tr>
                                ))}
                                {cart.length===0 && <tr><td colSpan="4" className="p-6 text-center text-text-secondary italic">Keranjang kosong</td></tr>}
                            </tbody>
                            {cart.length > 0 && (
                                <tfoot className="bg-gray-50 font-bold">
                                    <tr>
                                        <td colSpan="2" className="p-3 text-right">TOTAL</td>
                                        <td className="p-3 text-right text-lg">{formatRupiah(cart.reduce((a,b) => a + (b.qty * b.unit_cost), 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Payment Checkbox */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="isPaid" checked={formData.isPaid} onChange={e => setFormData({...formData, isPaid: e.target.checked})} className="w-5 h-5 accent-blue-600 rounded cursor-pointer" />
                            <label htmlFor="isPaid" className="text-sm font-bold text-blue-900 cursor-pointer select-none">Lunas Sekarang (Paid)</label>
                        </div>
                        
                        {formData.isPaid && (
                            <div className="ml-8 animate-fade-in">
                                <label className="text-xs font-bold text-text-secondary uppercase block mb-1.5">Bayar Menggunakan Akun:</label>
                                <div className="relative">
                                    <Wallet className="absolute left-3 top-3 w-4 h-4 text-gray-400"/>
                                    <select 
                                        className="input-luxury pl-10 bg-white" 
                                        value={formData.wallet_id} 
                                        onChange={e => setFormData({...formData, wallet_id: e.target.value})}
                                    >
                                        <option value="">-- Pilih Kas / Bank --</option>
                                        {wallets.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                                    </select>
                                </div>
                                <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1"><ArrowRight className="w-3 h-3"/> Saldo akan dipotong otomatis.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="btn-ghost-dark">Cancel</button>
                    <button onClick={handleSubmit} className="btn-gold px-8 shadow-lg">
                        {isEditing ? 'Update PO' : 'Submit Order'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}