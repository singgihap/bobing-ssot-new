"use client";
import TabsLayout from '@/components/TabsLayout';
import { SalesHistoryIcon, PurchasesIcon, InventoryIcon, VirtualStockIcon } from '@/components/DashboardIcons';
import TransactionsHistoryPage from '../transactions-history/page';
import PurchasesPage from '../purchases/page';
import InventoryPage from '../inventory/page';
import SupplierSessionsPage from '../supplier-sessions/page';

export default function OperationsHub() {
  const tabs = [
    { id: 'sales', label: <span className="flex items-center gap-2"><SalesHistoryIcon /> Riwayat Penjualan</span> },
    { id: 'purchases', label: <span className="flex items-center gap-2"><PurchasesIcon /> Pembelian (PO)</span> },
    { id: 'inventory', label: <span className="flex items-center gap-2"><InventoryIcon /> Stok Inventory</span> },
    { id: 'virtual', label: <span className="flex items-center gap-2"><VirtualStockIcon /> Virtual Stock</span> },
  ];

  return (
    <TabsLayout 
      title="Operations Hub" 
      subtitle="Pusat aktivitas transaksi dan pergerakan stok."
      tabs={tabs}
    >
      {(activeTab) => (
        <>
          {activeTab === 'sales' && <TransactionsHistoryPage />}
          {activeTab === 'purchases' && <PurchasesPage />}
          {activeTab === 'inventory' && <InventoryPage />}
          {activeTab === 'virtual' && <SupplierSessionsPage />}
        </>
      )}
    </TabsLayout>
  );
}
