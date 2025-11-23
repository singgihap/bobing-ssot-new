// components/Topbar.js
"use client";
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';

export default function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  // Ambil state dan setter dari Context
  const { setIsMobileMenuOpen, isSidebarCollapsed, setIsSidebarCollapsed } = useLayout();

  if (!user || pathname === '/login') return null;

  const getTitle = (path) => {
    if (path === '/dashboard') return 'Executive Dashboard';
    if (path.includes('products')) return 'Master Product';
    if (path.includes('sales')) return 'Point of Sale';
    if (path.includes('inventory')) return 'Inventory Control';
    if (path.includes('finance')) return 'Financial Reports';
    return 'System Overview';
  };

  return (
    <header className="glass-nav-dark h-16 px-4 md:px-6 flex items-center justify-between z-20 shrink-0 transition-all duration-300">
      
      {/* --- LEFT AREA --- */}
      <div className="flex items-center gap-3 md:gap-4">
        
        {/* 1. HAMBURGER MOBILE (Hanya muncul di HP) */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden p-2 text-lumina-muted hover:text-white rounded-lg hover:bg-lumina-highlight transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        {/* 2. HAMBURGER DESKTOP (Muncul di Desktop untuk Collapse Sidebar) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex p-2 text-lumina-muted hover:text-white rounded-lg hover:bg-lumina-highlight transition-colors"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Divider Kecil */}
        <div className="h-6 w-px bg-lumina-border hidden md:block mx-1"></div>

        {/* Title & Breadcrumb */}
        <div className="flex flex-col justify-center">
            <div className="hidden md:flex items-center text-[10px] font-bold text-lumina-muted uppercase tracking-widest mb-0.5">
                <span className="text-lumina-gold mr-2">App</span>
                <span>/ {pathname.split('/')[1] || 'home'}</span>
            </div>
            <h2 className="text-lg font-display font-bold text-white tracking-wide shadow-black drop-shadow-md leading-none">
            {getTitle(pathname)}
            </h2>
        </div>
      </div>

      {/* --- RIGHT AREA (Search & Profile) --- */}
      <div className="flex items-center gap-2 md:gap-5">
        {/* Search (Desktop Only) */}
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
        <div className="h-6 w-px bg-lumina-border hidden md:block"></div>

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