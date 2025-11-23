// components/Sidebar.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { 
    isMobileMenuOpen, 
    setIsMobileMenuOpen, 
    isSidebarCollapsed, 
  } = useLayout();

  if (!user || pathname === '/login') return null;

  const isActive = (path) => {
    const active = pathname === path || pathname.startsWith(path + '/');
    return active
      ? "bg-lumina-gold/10 text-lumina-gold border-l-2 border-lumina-gold" 
      : "text-lumina-muted hover:text-white hover:bg-lumina-highlight border-l-2 border-transparent";
  };

  // Komponen Item Menu
  const NavItem = ({ href, label, icon }) => (
    <Link 
      href={href} 
      onClick={() => setIsMobileMenuOpen(false)} 
      className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 mb-1 group relative ${isActive(href)} ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
      title={isSidebarCollapsed ? label : ''}
    >
      <span className={`shrink-0 ${isSidebarCollapsed ? 'text-lg' : ''} transition-all duration-200 group-hover:scale-110 group-hover:text-lumina-gold`}>{icon}</span>
      
      {!isSidebarCollapsed && (
        <span className="text-sm font-medium tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 animate-fade-in">
          {label}
        </span>
      )}
    </Link>
  );

  const NavHeader = ({ title }) => (
    !isSidebarCollapsed && (
      <div className="px-4 mt-6 mb-2 text-[10px] font-bold text-lumina-muted/50 uppercase tracking-widest font-display whitespace-nowrap animate-fade-in">
        {title}
      </div>
    )
  );

  // Overlay Mobile
  const MobileOverlay = () => (
    <div 
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={() => setIsMobileMenuOpen(false)}
    />
  );

  const Icon = ({ d }) => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>;

  return (
    <>
      <MobileOverlay />
      
      <aside 
        className={`
          bg-lumina-surface border-r border-lumina-border font-sans z-40
          /* FIX SCROLLING: Gunakan h-screen fixed atau h-full relatif terhadap layout parent */
          fixed md:static top-0 left-0 h-full 
          flex flex-col shrink-0
          transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
          ${isSidebarCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        {/* HEADER LOGO (Tanpa Tombol Toggle) */}
        <div className={`h-16 flex items-center border-b border-lumina-border shrink-0 transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-6'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-lumina-gold to-[#F6C945] rounded-lg flex items-center justify-center text-black shadow-gold-glow">
              <span className="font-display font-bold text-lg">B</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="fade-in whitespace-nowrap">
                <h1 className="font-display font-bold text-white tracking-wide text-lg">Lumina</h1>
                <p className="text-[9px] text-lumina-gold uppercase tracking-[0.2em]">Enterprise</p>
              </div>
            )}
          </div>
        </div>

        {/* MENU LIST (Scrollable Area) */}
        {/* FIX SCROLL: flex-1 dan overflow-y-auto wajib ada di sini */}
        <nav className="flex-1 px-0 py-4 overflow-y-auto scrollbar-hide">
          
          <NavHeader title="Overview" />
          <NavItem href="/dashboard" label="Dashboard" icon={<Icon d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />} />

          <NavHeader title="Master Data" />
          <NavItem href="/products" label="Produk Master" icon={<Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />} />
          <NavItem href="/variants" label="Variants (SKU)" icon={<Icon d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />} />
          <NavItem href="/brands" label="Brands" icon={<Icon d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />} />
          <NavItem href="/categories" label="Kategori" icon={<Icon d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />} />
          
          <NavHeader title="Relasi" />
          <NavItem href="/warehouses" label="Gudang" icon={<Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />} />
          <NavItem href="/suppliers" label="Supplier" icon={<Icon d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />} />
          <NavItem href="/customers" label="Pelanggan" icon={<Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />} />
          <NavItem href="/finance-accounts" label="Akun (COA)" icon={<Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />} />

          <NavHeader title="Operasional" />
          <NavItem href="/inventory" label="Inventory" icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />} />
          <NavItem href="/supplier-sessions" label="Virtual Stock" icon={<Icon d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1zm8-1a1 1 0 01-1 1H9v-2h5V4H9V2h5a1 1 0 011 1v12z" />} />
          <NavItem href="/purchases" label="Pembelian" icon={<Icon d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />} />

          <NavHeader title="Penjualan" />
          <NavItem href="/sales-manual" label="Kasir (POS)" icon={<Icon d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />} />
          <NavItem href="/sales-import" label="Import Sales" icon={<Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />} />
          
          <NavHeader title="Keuangan" />
          <NavItem href="/cash" label="Cash Flow" icon={<Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />} />
          <NavItem href="/finance-reports" label="Laba Rugi" icon={<Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />} />
          <NavItem href="/finance-balance" label="Neraca" icon={<Icon d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />} />
          
          <NavHeader title="Tools" />
          <NavItem href="/products-import" label="Import Produk" icon={<Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />} />
          <NavItem href="/purchases-import" label="Import PO" icon={<Icon d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />} />

          <div className="h-20"></div>
        </nav>

        {/* FOOTER USER */}
        <div className={`p-4 border-t border-lumina-border bg-lumina-base/50 shrink-0 transition-all ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center gap-3 mb-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-lumina-border flex items-center justify-center text-white text-xs font-bold ring-1 ring-lumina-highlight shrink-0">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-xs font-medium text-white truncate font-display">{user?.email}</p>
                <p className="text-[10px] text-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                </p>
              </div>
            )}
          </div>
          <button onClick={() => signOut(auth)} className={`w-full py-2.5 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 uppercase tracking-wider transition-all ${isSidebarCollapsed ? 'px-0' : ''}`}>
            {isSidebarCollapsed ? <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /> : "Sign Out"}
          </button>
        </div>
      </aside>
    </>
  );
}