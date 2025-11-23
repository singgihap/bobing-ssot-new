"use client";
import { useState } from 'react';
import CashFlowView from '@/components/finance/CashFlowView';
import ProfitLossView from '@/components/finance/ProfitLossView';
import BalanceSheetView from '@/components/finance/BalanceSheetView';
import CoaView from '@/components/finance/CoaView';

export default function FinanceHubPage() {
  const [activeTab, setActiveTab] = useState('cashflow');

  const tabs = [
    { id: 'cashflow', label: 'Arus Kas (Cash Flow)', icon: '💸' },
    { id: 'pl', label: 'Laba Rugi (P&L)', icon: '📈' },
    { id: 'balance', label: 'Neraca (Balance)', icon: '⚖️' },
    { id: 'coa', label: 'Akun (COA)', icon: '🗂️' },
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* Header & Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 px-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Pusat Keuangan</h2>
            <p className="text-sm text-slate-500">Laporan & Manajemen Keuangan Terpadu</p>
          </div>
        </div>
        
        <div className="flex space-x-1 bg-slate-100/50 p-1 rounded-xl overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        {activeTab === 'cashflow' && <CashFlowView />}
        {activeTab === 'pl' && <ProfitLossView />}
        {activeTab === 'balance' && <BalanceSheetView />}
        {activeTab === 'coa' && <CoaView />}
      </div>
    </div>
  );
}