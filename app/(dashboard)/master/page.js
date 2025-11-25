"use client";
import TabsLayout from '@/components/TabsLayout';
import { ProductsIcon, VariantsIcon, CategoriesIcon, BrandsIcon } from '@/components/DashboardIcons';
import ProductsPage from '../products/page';
import VariantsPage from '../variants/page';
import CategoriesPage from '../categories/page';
import BrandsPage from '../brands/page';

export default function MasterDataCenter() {
  const tabs = [
    { id: 'products', label: <span className="flex items-center gap-2"><ProductsIcon /> Produk</span> },
    { id: 'variants', label: <span className="flex items-center gap-2"><VariantsIcon /> Varian SKU</span> },
    { id: 'categories', label: <span className="flex items-center gap-2"><CategoriesIcon /> Kategori</span> },
    { id: 'brands', label: <span className="flex items-center gap-2"><BrandsIcon /> Brands</span> },
  ];

  return (
    <TabsLayout 
      title="Master Data Center" 
      subtitle="Pusat pengelolaan katalog produk dan atribut."
      tabs={tabs}
    >
      {(activeTab) => (
        <>
          {activeTab === 'products' && <ProductsPage />}
          {activeTab === 'variants' && <VariantsPage />}
          {activeTab === 'categories' && <CategoriesPage />}
          {activeTab === 'brands' && <BrandsPage />}
        </>
      )}
    </TabsLayout>
  );
}
