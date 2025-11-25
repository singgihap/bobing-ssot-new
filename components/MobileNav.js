// MobileNav.js

"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Portal } from '@/lib/usePortal';

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user || pathname === '/login') return null;

  // Fungsi cek aktif (mendukung nested routes)
  const isActive = (path) => pathname === path || pathname.startsWith(path + '/');

  // Icon Helper
  // Catatan: Menggunakan SVG D-path yang disederhanakan dari Sidebar untuk Mobile Nav
  const NavIcon = ({ d, active }) => (
    <svg className={`w-6 h-6 transition-all duration-300 ${active ? 'text-lumina-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] -translate-y-1' : 'text-lumina-muted'}`} fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.5"} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );

  // Drawer Item Helper
  const DrawerItem = ({ href, label, iconD, description, onClick }) => (
    <Link 
      href={href}
      onClick={onClick}
      className={`flex items-center p-3 rounded-xl transition-all duration-200 
        ${isActive(href) ? 'bg-lumina-base text-white shadow-lg' : 'hover:bg-lumina-base/5'}
      `}
    >
      <svg className={`w-6 h-6 shrink-0 mr-4 ${isActive(href) ? 'text-lumina-gold' : 'text-lumina-muted'}`} 
           fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={iconD} />
      </svg>
      <div>
        <p className={`text-sm font-semibold ${isActive(href) ? 'text-white' : 'text-lumina-muted'}`}>{label}</p>
        <p className="text-xs text-lumina-muted/70">{description}</p>
      </div>
    </Link>
  );

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // SVG Paths (D-path) dari Sidebar
  const D_DASH = "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
  const D_POS = "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z";
  const D_MASTER = "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
  const D_OPS = "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01";
  const D_PARTNER = "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z";
  const D_MONEY = "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
  const D_CATALOG = "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10";
  const D_STOCK = "M20 7h-9m4 4h-9m4 4h-9M21 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2z";
  const D_PURCHASES = "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z";

  return (
    <>
      <div className={`fixed bottom-0 left-0 right-0 h-16 bg-lumina-base border-t border-lumina-border z-30 flex justify-around md:hidden`}>
        <Link href="/dashboard" className="flex flex-col items-center justify-center">
          <NavIcon d={D_DASH} active={isActive('/dashboard')} />
          <span className={`text-[10px] ${isActive('/dashboard') ? 'text-white font-bold' : 'text-lumina-muted'}`}>Home</span>
        </Link>
        
        <Link href="/sales/manual" className="flex flex-col items-center justify-center">
          {/* TAUTAN DIUBAH DARI /sales-manual KE /sales/manual */}
          <NavIcon d={D_POS} active={isActive('/sales/manual')} />
          <span className={`text-[10px] ${isActive('/sales/manual') ? 'text-white font-bold' : 'text-lumina-muted'}`}>POS</span>
        </Link>
        
        <button onClick={toggleMenu} className="flex flex-col items-center justify-center focus:outline-none">
          <NavIcon d="M4 6h16M4 12h16M4 18h16" active={isMenuOpen} />
          <span className={`text-[10px] ${isMenuOpen ? 'text-white font-bold' : 'text-lumina-muted'}`}>Menu</span>
        </button>

        <Link href="/finance" className="flex flex-col items-center justify-center">
          <NavIcon d={D_MONEY} active={isActive('/finance')} />
          <span className={`text-[10px] ${isActive('/finance') ? 'text-white font-bold' : 'text-lumina-muted'}`}>Finance</span>
        </Link>

        <Link href="/settings" className="flex flex-col items-center justify-center">
          <NavIcon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" active={isActive('/settings')} />
          <span className={`text-[10px] ${isActive('/settings') ? 'text-white font-bold' : 'text-lumina-muted'}`}>Settings</span>
        </Link>
      </div>

      {isMenuOpen && (
        <Portal>
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden" 
            onClick={toggleMenu}
          ></div>
          <div className="fixed top-0 right-0 w-full max-w-xs h-full bg-[#181A1F] border-l border-lumina-border p-6 z-50 overflow-y-auto">
            
            <h2 className="text-xl font-bold text-white mb-6">Navigation</h2>
            
            {/* MAIN MENU */}
            <h3 className="text-xs font-bold text-lumina-muted/50 uppercase tracking-[0.2em] mb-3">Main Menu</h3>
            <div className="space-y-3">
              <DrawerItem 
                href="/dashboard" 
                label="Dashboard" 
                description="Ringkasan Utama Bisnis"
                iconD={D_DASH}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/sales/manual" 
                label="Point of Sales" 
                description="Penjualan Manual Langsung"
                iconD={D_POS}
                onClick={toggleMenu}
              />
            </div>
            
            {/* BUSINESS FLOW (MENU BARU) */}
            <h3 className="text-xs font-bold text-lumina-muted/50 uppercase tracking-[0.2em] mt-6 mb-3">Business Flow</h3>
            <div className="space-y-3">
              {/* CATALOG */}
              <h4 className="text-sm font-semibold text-lumina-gold/80 mt-4">Catalog</h4>
              <DrawerItem 
                href="/catalog/products" 
                label="Products" 
                description="Daftar & Manajemen Produk"
                iconD={D_CATALOG}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/catalog/variants" 
                label="Variants" 
                description="Atur Varian Produk"
                iconD={D_CATALOG}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/catalog/categories" 
                label="Categories" 
                description="Kelompok Produk"
                iconD={D_CATALOG}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/catalog/brands" 
                label="Brands" 
                description="Daftar Merek"
                iconD={D_CATALOG}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/catalog/import" 
                label="Import Product" 
                description="Mass Upload Produk Baru"
                iconD={D_CATALOG}
                onClick={toggleMenu}
              />

              {/* STOCK */}
              <h4 className="text-sm font-semibold text-lumina-gold/80 mt-4">Stock</h4>
              <DrawerItem 
                href="/stock/inventory" 
                label="Inventory" 
                description="Lihat Status Stok & HPP"
                iconD={D_STOCK}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/stock/warehouses" 
                label="Warehouses" 
                description="Manajemen Gudang Fisik"
                iconD={D_STOCK}
                onClick={toggleMenu}
              />
              {/* DIUBAH: Pindah ke Stock sesuai domain bisnis */}
              <DrawerItem 
                href="/stock/supplier-sessions" 
                label="Supplier Sessions" 
                description="Penyesuaian Stok Pemasok"
                iconD={D_STOCK}
                onClick={toggleMenu}
              />

              {/* PURCHASES */}
              <h4 className="text-sm font-semibold text-lumina-gold/80 mt-4">Purchases</h4>
               <DrawerItem 
                href="/purchases" 
                label="Purchases Overview" 
                description="Ringkasan Pembelian"
                iconD={D_PURCHASES}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/purchases/suppliers" 
                label="Suppliers" 
                description="Daftar Pemasok"
                iconD={D_PURCHASES}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/purchases/import" 
                label="Import Purchases" 
                description="Import Data Pembelian"
                iconD={D_PURCHASES}
                onClick={toggleMenu}
              />
              

              {/* SALES */}
              <h4 className="text-sm font-semibold text-lumina-gold/80 mt-4">Sales</h4>
              <DrawerItem 
                href="/sales" 
                label="Sales Overview" 
                description="Ringkasan Penjualan"
                iconD={D_POS}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/sales/import" 
                label="Import Sales" 
                description="Rekap Data Marketplace"
                iconD={D_POS}
                onClick={toggleMenu}
              />
              {/* DIUBAH: Pindah ke Sales sesuai domain bisnis */}
              <DrawerItem 
                href="/sales/transactions" 
                label="Sales History" 
                description="Riwayat Transaksi Penjualan"
                iconD={D_POS}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/sales/customers" 
                label="Customers" 
                description="Daftar Pelanggan"
                iconD={D_POS}
                onClick={toggleMenu}
              />
            </div>

            {/* MANAGEMENT */}
            <h3 className="text-xs font-bold text-lumina-muted/50 uppercase tracking-[0.2em] mt-6 mb-3">Management</h3>
            <div className="space-y-3">
              <DrawerItem 
                href="/master" 
                label="Master Data" 
                description="Data Pokok & Atribut"
                iconD={D_MASTER}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/operations" 
                label="Operations" 
                description="Pengaturan Operasional Harian"
                iconD={D_OPS}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/partners" 
                label="Partners" 
                description="Daftar Mitra Bisnis"
                iconD={D_PARTNER}
                onClick={toggleMenu}
              />
            </div>

            {/* ACCOUNTING */}
            <h3 className="text-xs font-bold text-lumina-muted/50 uppercase tracking-[0.2em] mt-6 mb-3">Accounting</h3>
            <div className="space-y-3">
              <DrawerItem 
                href="/finance" 
                label="Finance Overview" 
                description="Ringkasan Keuangan"
                iconD={D_MONEY}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/finance/accounts" 
                label="Accounts" 
                description="Daftar Akun Bank/Kas"
                iconD={D_MONEY}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/finance/balance" 
                label="Balance" 
                description="Laporan Saldo Keuangan"
                iconD={D_MONEY}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/finance/reports" 
                label="Reports" 
                description="Laporan Laba/Rugi, Dll."
                iconD={D_MONEY}
                onClick={toggleMenu}
              />
              <DrawerItem 
                href="/finance/cash" 
                label="Cash" 
                description="Manajemen Kas Kecil/Besar"
                iconD={D_MONEY}
                onClick={toggleMenu}
              />
              {/* Catatan: Finance/transactions dikosongkan/akan dikembangkan untuk transaksi non-sales/purchase */}
            </div>

            {/* FOOTER */}
            <div className="mt-8 pt-4 border-t border-lumina-border/30">
              <DrawerItem 
                href="/settings" 
                label="Settings" 
                description="Konfigurasi Toko"
                iconD="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                onClick={toggleMenu}
              />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}