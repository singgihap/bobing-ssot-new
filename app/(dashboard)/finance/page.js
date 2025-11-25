"use client";
import TabsLayout from '@/components/TabsLayout';
import { ProfitLossIcon, BalanceSheetIcon, CashFlowIcon, ChartOfAccountsIcon } from '@/components/DashboardIcons';
import CashFlowPage from '../cash/page';
import ReportPLPage from '../finance-reports/page';
import BalanceSheetPage from '../finance-balance/page';
import FinanceAccountsPage from '../finance-accounts/page';

export default function FinanceCenter() {
  const tabs = [
    { id: 'dashboard', label: <span className="flex items-center gap-2"><ProfitLossIcon /> Laba Rugi</span> },
    { id: 'balance', label: <span className="flex items-center gap-2"><BalanceSheetIcon /> Neraca</span> },
    { id: 'cash', label: <span className="flex items-center gap-2"><CashFlowIcon /> Arus Kas</span> },
    { id: 'accounts', label: <span className="flex items-center gap-2"><ChartOfAccountsIcon  /> Chart of Accounts</span> },
  ];

  return (
    <TabsLayout 
      title="Finance Control" 
      subtitle="Pusat kendali keuangan, akuntansi, dan laporan."
      tabs={tabs}
    >
      {(activeTab) => (
        <>
          {activeTab === 'dashboard' && <ReportPLPage />}
          {activeTab === 'balance' && <BalanceSheetPage />}
          {activeTab === 'cash' && <CashFlowPage />}
          {activeTab === 'accounts' && <FinanceAccountsPage />}
        </>
      )}
    </TabsLayout>
  );
}
