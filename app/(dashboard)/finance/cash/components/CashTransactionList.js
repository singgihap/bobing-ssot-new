"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, ArrowRight, Edit2, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';

export default function CashTransactionList({ groupedTransactions, loading, accounts, onEdit, onDelete }) {
    const [expandedDate, setExpandedDate] = useState(null);

    if (loading) return <Skeleton className="h-32 w-full rounded-2xl"/>;
    
    if (groupedTransactions.length === 0) {
        return <div className="p-10 text-center text-text-secondary border-2 border-dashed border-border rounded-2xl">Belum ada transaksi manual.</div>;
    }

    return (
        <div className="space-y-4">
            {groupedTransactions.map((group) => (
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
                                          <button onClick={()=>onEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3.5 h-3.5"/></button>
                                          <button onClick={()=>onDelete(item)} className="p-1.5 text-text-secondary hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
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
    );
}