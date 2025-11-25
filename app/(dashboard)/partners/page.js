"use client";
import TabsLayout from '@/components/TabsLayout';
import { CustomersIcon, SuppliersIcon, WarehousesIcon } from '@/components/DashboardIcons';
import CustomersPage from '../customers/page';
import SuppliersPage from '../suppliers/page';
import WarehousesPage from '../warehouses/page';

export default function PartnerCenter() {
  const tabs = [
    { id: 'customers', label: <span className="flex items-center gap-2"><CustomersIcon /> Pelanggan</span> },
    { id: 'suppliers', label: <span className="flex items-center gap-2"><SuppliersIcon /> Supplier</span> },
    { id: 'warehouses', label: <span className="flex items-center gap-2"><WarehousesIcon /> Gudang</span> },
  ];

  return (
    <TabsLayout 
      title="Partner & Locations" 
      subtitle="Kelola relasi bisnis dan lokasi penyimpanan."
      tabs={tabs}
    >
      {(activeTab) => (
        <>
          {activeTab === 'customers' && <CustomersPage />}
          {activeTab === 'suppliers' && <SuppliersPage />}
          {activeTab === 'warehouses' && <WarehousesPage />}
        </>
      )}
    </TabsLayout>
  );
}
