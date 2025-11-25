// components/Sidebar.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLayout } from '@/context/LayoutContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isSidebarCollapsed } = useLayout();

  if (!user || pathname === '/login') return null;

  const isActive = (path) => pathname.startsWith(path);

  const NavItem = ({ href, label, icon, activeIcon }) => (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative mx-2 my-1
        ${isActive(href) 
          ? "bg-gradient-to-r from-lumina-gold/20 to-transparent border-l-4 border-lumina-gold text-white shadow-[0_0_20px_rgba(212,175,55,0.1)]" 
          : "text-lumina-muted hover:text-white hover:bg-white/5 border-l-4 border-transparent"
        } 
        ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
      title={isSidebarCollapsed ? label : ''}
    >
      <span className={`shrink-0 text-xl transition-transform duration-300 ${isActive(href) ? 'scale-110 text-lumina-gold' : 'group-hover:scale-110'}`}>
        {isActive(href) && activeIcon ? activeIcon : icon}
      </span>
      
      {!isSidebarCollapsed && (
        <span className="text-sm font-medium tracking-wide whitespace-nowrap">{label}</span>
      )}
    </Link>
  );

  const NavCategory = ({ title }) => (
    !isSidebarCollapsed && (
      <div className="px-6 mt-6 mb-2 text-[10px] font-bold text-lumina-muted/40 uppercase tracking-[0.2em] font-display">
        {title}
      </div>
    )
  );

  // ICONS (Menggunakan SVG yang sudah disederhanakan)
  const IconDash = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
  const IconMaster = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
  const IconOps = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
  const IconPartner = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const IconMoney = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const IconPOS = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
  
  // ICON TAMBAHAN UNTUK KELOMPOK BARU
  const IconCatalog = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
  const IconStock = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7h-9m4 4h-9m4 4h-9M21 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2z" /></svg>;
  const IconPurchases = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;


  return (
    <aside className={`bg-lumina-base border-r border-lumina-border font-sans z-40 hidden md:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
      {/* HEADER */}
      <div className={`h-20 flex items-center shrink-0 transition-all ${isSidebarCollapsed ? 'justify-center' : 'px-6'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-lumina-gold to-amber-500 rounded-xl flex items-center justify-center text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]">
            <span className="font-display font-bold text-xl">B</span>
          </div>
          {!isSidebarCollapsed && (
            <div className="fade-in">
              <h1 className="font-display font-bold text-white text-lg tracking-wide">Lumina</h1>
              <p className="text-[9px] text-lumina-gold uppercase tracking-[0.2em] font-bold opacity-80">Enterprise</p>
            </div>
          )}
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        <NavCategory title="Main Menu" />
        <NavItem href="/dashboard" label="Dashboard" icon={IconDash} />
        {/* UPDATED: Dari /sales-manual menjadi /sales/manual */}
        <NavItem href="/sales/manual" label="Point of Sales" icon={IconPOS} /> 

        {/* KATEGORI BARU UNTUK ALIRAN BISNIS UTAMA */}
        <NavCategory title="Business Flow" /> 
        {/* TAUTAN MENGGUNAKAN ROOT GROUP YANG AKAN DI-REDIRECT KE HALAMAN UTAMA KELOMPOK MASING-MASING */}
        <NavItem href="/catalog" label="Catalog" icon={IconCatalog} />
        <NavItem href="/stock" label="Stock" icon={IconStock} />
        <NavItem href="/purchases" label="Purchases" icon={IconPurchases} />
        <NavItem href="/sales" label="Sales" icon={IconPOS} />
        
        <NavCategory title="Management" />
        <NavItem href="/master" label="Master Data" icon={IconMaster} />
        <NavItem href="/operations" label="Operations" icon={IconOps} />
        <NavItem href="/partners" label="Partners" icon={IconPartner} />
        
        <NavCategory title="Accounting" />
        <NavItem href="/finance" label="Finance" icon={IconMoney} />
      </nav>

      {/* FOOTER SETTINGS */}
      <div className="p-4 border-t border-lumina-border bg-[#0F1115]">
        <Link href="/settings" className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}>
           <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lumina-muted">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
           </div>
           {!isSidebarCollapsed && (
             <div>
               <p className="text-xs font-bold text-white">Settings</p>
               <p className="text-[9px] text-lumina-muted">System Config</p>
             </div>
           )}
        </Link>
      </div>
    </aside>
  );
}