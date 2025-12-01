"use client";
import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import TransactionDetail from './TransactionDetail';

export default function TransactionCardList({ 
    orders, loading, expandedId, setExpandedId,
    getItemsList, editingId, editForm, setEditForm,
    onStartEdit, onCancelEdit, onSaveEdit, onDelete 
}) {
    return (
        <div className="md:hidden space-y-3">
            {loading ? <div className="text-center py-10 animate-pulse">Loading...</div> : 
             orders.length === 0 ? <div className="text-center py-10 text-gray-400">Tidak ada data.</div> :
             orders.map(order => {
                const isExpanded = expandedId === order.id;
                return (
                    <div key={order.id} className="bg-white p-4 rounded-xl border border-border shadow-sm active:scale-[0.99] transition-transform">
                        <div className="flex justify-between items-start" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                            <div className="flex gap-3">
                                <div className={`mt-1 transition-transform ${isExpanded ? 'rotate-90 text-primary' : 'text-gray-300'}`}><ChevronRight className="w-5 h-5"/></div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-text-primary">{order.buyer_name}</span>
                                        <span className="text-[10px] bg-gray-100 px-1.5 rounded text-text-secondary">{order.display_channel}</span>
                                    </div>
                                    <div className="text-xs text-text-secondary mt-0.5 font-mono">{order.display_order_number}</div>
                                    <div className="text-[10px] text-text-secondary mt-1">{order.display_date_str}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-text-primary">{formatRupiah(order.fin_gross)}</div>
                                <div className={`text-[10px] uppercase font-bold ${order.display_status.includes('paid')?'text-emerald-600':'text-amber-600'}`}>{order.display_status}</div>
                            </div>
                        </div>
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                    <TransactionDetail 
                                        order={order} items={getItemsList(order)}
                                        isEditing={editingId === order.id}
                                        editForm={editForm} setEditForm={setEditForm}
                                        onStartEdit={onStartEdit} onCancelEdit={onCancelEdit}
                                        onSaveEdit={onSaveEdit} onDelete={onDelete}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            })}
        </div>
    );
}