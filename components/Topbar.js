// components/Topbar.js
"use client";
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user || pathname === '/login') return null;

  // Mapping Judul Halaman yang komprehensif sesuai Sidebar
  const getTitle = (path) => {
    // Overview
    if (path === '/dashboard') return 'Executive Dashboard';
    
    // Master Data
    if (path === '/products') return 'Master Product';
    if (path === '/variants') return 'Master SKU (Variants)';
    if (path === '/brands') return 'Brand Management';
    if (path === '/categories') return 'Category Management';
    
    // Relasi & Lokasi
    if (path === '/warehouses') return 'Warehouse Management';
    if (path === '/suppliers') return 'Supplier Database';
    if (path === '/customers') return 'Customer CRM';
    
    // Akun
    if (path === '/finance-accounts') return 'Chart of Accounts';
    
    // Operasional
    if (path === '/inventory') return 'Inventory Control';
    if (path === '/supplier-sessions') return 'Virtual Stock (JIT)';
    if (path === '/purchases') return 'Purchase Orders';
    
    // Penjualan
    if (path === '/sales-manual') return 'Point of Sale (POS)';
    
    // Keuangan
    if (path === '/cash') return 'Cash Flow Management';
    if (path === '/finance-reports') return 'Profit & Loss Statement';
    if (path === '/finance-balance') return 'Balance Sheet';
    
    // Tools Import
    if (path === '/products-import') return 'Import Products';
    if (path === '/purchases-import') return 'Import Purchase Orders';
    if (path === '/sales-import') return 'Import Sales Data';

    return 'Bobing Command Center';
  };

  return (
    <header className="glass-nav-dark h-16 px-8 flex items-center justify-between z-20">
      {/* Left: Title & Breadcrumb Indicator */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center text-[10px] font-bold text-lumina-muted uppercase tracking-widest">
            <span className="text-lumina-gold">App</span>
            <svg className="w-3 h-3 mx-2 text-lumina-border" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
            <span>{pathname.split('/')[1]}</span>
        </div>
        <div className="h-4 w-px bg-lumina-border hidden md:block mx-2"></div>
        <h2 className="text-lg font-display font-bold text-white tracking-wide shadow-black drop-shadow-md">
          {getTitle(pathname)}
        </h2>
      </div>

      {/* Right: Search & Profile Actions */}
      <div className="flex items-center gap-5">
        {/* Search Bar */}
        <div className="hidden md:flex items-center bg-lumina-base border border-lumina-border rounded-lg px-3 py-1.5 w-64 focus-within:border-lumina-gold focus-within:ring-1 focus-within:ring-lumina-gold transition-all shadow-inner">
          <svg className="w-4 h-4 text-lumina-muted mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" placeholder="Quick search..." className="bg-transparent text-xs outline-none w-full text-lumina-text placeholder-lumina-muted/50 font-mono" />
          <span className="text-[9px] text-lumina-muted border border-lumina-border px-1 rounded bg-lumina-surface">⌘K</span>
        </div>
        
        {/* Notification Bell */}
        <button className="relative p-2 text-lumina-muted hover:text-lumina-gold transition-colors group">
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full ring-1 ring-lumina-base group-hover:animate-ping"></span>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full ring-1 ring-lumina-base"></span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-lumina-border"></div>

        {/* User Profile (Mini) */}
        <div className="flex items-center gap-3 cursor-pointer group">
           <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white group-hover:text-lumina-gold transition-colors">{user?.email?.split('@')[0]}</p>
              <p className="text-[9px] text-lumina-muted uppercase tracking-wider">Admin</p>
           </div>
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lumina-gold to-amber-600 p-[1px] shadow-gold-glow">
              <div className="w-full h-full rounded-lg bg-lumina-surface flex items-center justify-center">
                <span className="text-xs font-bold text-white group-hover:text-lumina-gold transition-colors">{user?.email?.charAt(0).toUpperCase()}</span>
              </div>
           </div>
        </div>
      </div>
    </header>
  );
}