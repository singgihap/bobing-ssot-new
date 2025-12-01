"use client";
import React from 'react';
import { ChevronDown, ChevronUp, CheckCircle, Truck, X, Clock } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import TransactionDetail from './TransactionDetail';

// Helper Status Badge
const getStatusBadge = (status) => {
    const s = String(status).toLowerCase();
    let classes = "bg-gray-100 text-gray-600 border-gray-200";
    let icon = <Clock className="w-3 h-3 mr-1"/>;
    
    if (s.includes('completed') || s.includes('selesai') || s.includes('paid')) { classes = "bg-emerald-50 text-emerald-700 border-emerald-100"; icon = <CheckCircle className="w-3 h-3 mr-1"/>; }
    else if (s.includes('dikirim')) { classes = "bg-blue-50 text-blue-700 border-blue-100"; icon = <Truck className="w-3 h-3 mr-1"/>; }
    else if (s.includes('cancel') || s.includes('batal')) { classes = "bg-rose-50 text-rose-700 border-rose-100"; icon = <X className="w-3 h-3 mr-1"/>; }
    
    return <span className={`flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${classes}`}>{icon} {status}</span>;
};

export default function TransactionTable({ 
    orders, loading, expandedId, setExpandedId,
    getItemsList, editingId, editForm, setEditForm,
    onStartEdit, onCancelEdit, onSaveEdit, onDelete 
}) {
    return (
        <div className="hidden md:block bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 sticky top-0 z-10 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                        <tr>
                            <th className="w-12 py-4 pl-6"></th>
                            <th className="py-4 px-4">Date & ID</th>
                            <th className="py-4 px-4">Customer</th>
                            <th className="py-4 px-4 text-center">Channel</th>
                            <th className="py-4 px-4 text-center">Status</th>
                            <th className="py-4 px-4 text-right">Total</th>
                            <th className="py-4 px-4 text-right">Profit</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-text-primary divide-y divide-border/60">
                        {loading ? <tr><td colSpan="7" className="text-center py-20 text-text-secondary animate-pulse">Loading...</td></tr> : 
                         orders.length === 0 ? <tr><td colSpan="7" className="text-center py-20 text-text-secondary">Tidak ada data.</td></tr> :
                         orders.map((order) => {
                            const isExpanded = expandedId === order.id;
                            return (
                                <React.Fragment key={order.id}>
                                    <tr onClick={() => setExpandedId(isExpanded ? null : order.id)} className={`cursor-pointer hover:bg-gray-50/50 ${isExpanded ? 'bg-gray-50 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}>
                                        <td className="py-4 pl-6 text-center text-text-secondary">{isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</td>
                                        <td className="py-4 px-4">
                                            <div className="font-mono text-xs text-text-secondary mb-0.5">{order.display_date_str}</div>
                                            <div className="font-bold text-text-primary hover:text-primary transition-colors">{order.display_order_number}</div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="font-medium text-text-primary">{order.buyer_name || 'Guest'}</div>
                                            <div className="text-xs text-text-secondary">{order.payment_method}</div>
                                        </td>
                                        <td className="py-4 px-4 text-center"><span className="bg-gray-100 px-2 py-1 rounded text-[10px] uppercase font-bold border border-gray-200">{order.display_channel}</span></td>
                                        <td className="py-4 px-4 flex justify-center">{getStatusBadge(order.display_status)}</td>
                                        <td className="py-4 px-4 text-right font-bold">{formatRupiah(order.fin_gross)}</td>
                                        <td className="py-4 px-4 text-right">
                                            <span className={`font-mono font-bold ${order.fin_profit>=0?'text-emerald-600':'text-rose-600'}`}>{formatRupiah(order.fin_profit)}</span>
                                        </td>
                                    </tr>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.tr initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                                                <td colSpan="7" className="p-0 border-t border-border bg-gray-50/30">
                                                    <TransactionDetail 
                                                        order={order} items={getItemsList(order)}
                                                        isEditing={editingId === order.id}
                                                        editForm={editForm} setEditForm={setEditForm}
                                                        onStartEdit={onStartEdit} onCancelEdit={onCancelEdit}
                                                        onSaveEdit={onSaveEdit} onDelete={onDelete}
                                                    />
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}