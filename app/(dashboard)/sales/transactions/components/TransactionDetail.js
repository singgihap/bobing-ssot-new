"use client";
import React from 'react';
import { Package, Truck, User, CreditCard, Save, Trash2, Edit2 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

export default function TransactionDetail({ 
    order, items, isEditing, editForm, setEditForm, 
    onCancelEdit, onSaveEdit, onStartEdit, onDelete 
}) {
    return (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 relative text-sm">
            {/* Action Buttons (Top Right) */}
            <div className="md:absolute top-4 right-6 z-10 flex justify-end mb-4 md:mb-0">
                {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={onCancelEdit} className="btn-ghost-dark text-xs px-3 py-1.5 bg-white shadow-sm">Batal</button>
                        <button onClick={()=>onSaveEdit(order.id, order)} className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 flex items-center gap-1 shadow-md">
                            <Save className="w-3 h-3"/> Simpan
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={()=>onDelete(order)} className="text-xs text-rose-500 hover:bg-rose-50 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-rose-200 transition-colors">
                            <Trash2 className="w-3 h-3"/> Void (Batal)
                        </button>
                        <button onClick={()=>onStartEdit(order)} className="text-xs text-primary hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-blue-50 transition-colors">
                            <Edit2 className="w-3 h-3"/> Edit Data
                        </button>
                    </div>
                )}
            </div>

            {/* ITEMS LIST */}
            <div className="md:col-span-2 space-y-3">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-4 h-4"/> Item Details ({items.length})
                </h4>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border shadow-sm">
                            <div className="flex-1 mr-4">
                                <div className="text-sm font-bold text-text-primary line-clamp-1">{item.name}</div>
                                <div className="text-[10px] text-text-secondary font-mono flex gap-2 mt-1">
                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{item.sku}</span>
                                    {item.variant !== '-' && <span className="opacity-80">{item.variant}</span>}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-emerald-600 font-mono">{formatRupiah(item.price * item.qty)}</div>
                                <div className="text-[10px] text-text-secondary mt-0.5">
                                    {item.qty} x {formatRupiah(item.price)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* INFO DETAILS */}
            <div className="space-y-4 font-mono text-xs border-l border-border pl-0 md:pl-6 pt-4 md:pt-0">
                {/* Shipping */}
                <div className="bg-white p-3 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-2 text-text-secondary uppercase font-bold text-[10px] mb-2">
                        <Truck className="w-3.5 h-3.5"/> Pengiriman
                    </div>
                    <div className="text-text-primary font-bold text-sm mb-1">{order.op_courier}</div>
                    {isEditing ? (
                        <input className="input-luxury w-full py-1.5 text-xs mt-1" placeholder="Input Resi" value={editForm.awb_number} onChange={e=>setEditForm({...editForm, awb_number:e.target.value})} />
                    ) : (
                        <div className={`text-[10px] break-all inline-block px-2 py-1 rounded-md font-medium ${order.op_tracking ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-100 text-gray-400 italic'}`}>
                            {order.op_tracking || 'No Resi'}
                        </div>
                    )}
                </div>

                {/* Customer */}
                <div className="bg-white p-3 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-2 text-text-secondary uppercase font-bold text-[10px] mb-2">
                        <User className="w-3.5 h-3.5"/> Pelanggan
                    </div>
                    <div><div className="font-bold text-text-primary">{order.buyer_name || 'Guest'}</div></div>
                    <div><div className="text-[10px] text-text-secondary mt-1">{order.buyer_phone || '-'}</div></div>
                    <div className="mt-1 leading-tight text-text-secondary text-[10px]">{order.buyer_address || '-'}</div>
                </div>

                {/* Finance Summary */}
                <div className="bg-white p-3 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-2 text-text-secondary uppercase font-bold text-[10px] mb-2">
                        <CreditCard className="w-3.5 h-3.5"/> Rincian Biaya
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(order.fin_subtotal)}</span></div>
                        <div className="flex justify-between text-rose-500"><span>Diskon</span>{isEditing ? <input type="number" className="w-16 text-right border rounded px-1 text-xs" value={editForm.discount} onChange={e=>setEditForm({...editForm, discount:e.target.value})} /> : <span>{formatRupiah(order.financial?.discount || 0)}</span>}</div>
                        <div className="flex justify-between text-text-secondary"><span>Ongkir</span>{isEditing ? <input type="number" className="w-16 text-right border rounded px-1 text-xs" value={editForm.shipping_fee} onChange={e=>setEditForm({...editForm, shipping_fee:e.target.value})} /> : <span>{formatRupiah(order.financial?.shipping_fee || 0)}</span>}</div>
                        <div className="flex justify-between text-text-secondary"><span>Admin/Tax</span>{isEditing ? <input type="number" className="w-16 text-right border rounded px-1 text-xs" value={editForm.service_fee} onChange={e=>setEditForm({...editForm, service_fee:e.target.value})} /> : <span>{formatRupiah((order.financial?.service_fee||0) + (order.financial?.tax||0))}</span>}</div>
                        <div className="border-t border-dashed border-border pt-1 flex justify-between font-bold text-emerald-700"><span>Total</span><span>{formatRupiah(order.fin_gross)}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}