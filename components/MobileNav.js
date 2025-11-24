"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
// Mengubah alias '@/' menjadi relative path '../' untuk memastikan resolusi modul berhasil
import { useAuth } from '../context/AuthContext';
import { Portal } from '../lib/usePortal';

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user || pathname === '/login') return null;

  // Fungsi cek aktif
  const isActive = (path) => pathname === path || pathname.startsWith(path + '/');

  // Icon Helper
  const NavIcon = ({ d, active }) => (
    <svg className={`w-6 h-6 transition-colors ${active ? 'text-lumina-gold drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]' : 'text-lumina-muted'}`} fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.5"} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );

  const MenuItem = ({ href, label, iconD, onClick }) => (
    <Link 
      href={href}
      onClick={() => { setIsMenuOpen(false); if(onClick) onClick(); }}
      className="flex items-center gap-4 p-4 rounded-xl active:bg-lumina-highlight transition-colors border border-transparent hover:border-lumina-border"
    >
      <div className="w-10 h-10 rounded-full bg-lumina-base flex items-center justify-center text-lumina-gold">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={iconD} /></svg>
      </div>
      <span className="text-sm font-medium text-lumina-text">{label}</span>
    </Link>
  );

  return (
    <>
      {/* --- BOTTOM BAR --- */}
      <div className="md:hidden glass-bottom-nav flex justify-around items-center h-[60px] px-2 fixed bottom-0 w-full z-50 bg-lumina-surface border-t border-lumina-border pb-safe">
        
        <Link href="/dashboard" className="flex flex-col items-center justify-center w-16 h-full gap-1" onClick={() => setIsMenuOpen(false)}>
          <NavIcon d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" active={isActive('/dashboard')} />
          <span className={`text-[9px] font-medium ${isActive('/dashboard') ? 'text-lumina-gold' : 'text-lumina-muted'}`}>Home</span>
        </Link>

        <Link href="/sales-manual" className="flex flex-col items-center justify-center w-16 h-full gap-1" onClick={() => setIsMenuOpen(false)}>
          <NavIcon d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" active={isActive('/sales-manual')} />
          <span className={`text-[9px] font-medium ${isActive('/sales-manual') ? 'text-lumina-gold' : 'text-lumina-muted'}`}>POS</span>
        </Link>

        {/* Floating Action Button (Center) */}
        <div className="relative -top-5">
           <button 
             onClick={() => setIsMenuOpen(true)}
             className="w-14 h-14 bg-gradient-to-br from-lumina-gold to-amber-500 rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] border-4 border-lumina-base active:scale-95 transition-transform"
           >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
           </button>
        </div>

        <Link href="/inventory" className="flex flex-col items-center justify-center w-16 h-full gap-1" onClick={() => setIsMenuOpen(false)}>
          <NavIcon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" active={isActive('/inventory')} />
          <span className={`text-[9px] font-medium ${isActive('/inventory') ? 'text-lumina-gold' : 'text-lumina-muted'}`}>Stock</span>
        </Link>

        <Link href="/finance-reports" className="flex flex-col items-center justify-center w-16 h-full gap-1" onClick={() => setIsMenuOpen(false)}>
          <NavIcon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" active={isActive('/finance-reports')} />
          <span className={`text-[9px] font-medium ${isActive('/finance-reports') ? 'text-lumina-gold' : 'text-lumina-muted'}`}>Laporan</span>
        </Link>

      </div>

      {/* --- FULL SCREEN MENU DRAWER --- */}
      <Portal>
        <div className={`fixed inset-0 z-[60] md:hidden transition-all duration-300 ${isMenuOpen ? 'visible' : 'invisible'}`}>
          {/* Backdrop */}
          <div 
            className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Drawer Content */}
          <div className={`absolute bottom-0 left-0 right-0 bg-lumina-surface rounded-t-3xl border-t border-lumina-border p-6 pb-24 transition-transform duration-300 transform ${isMenuOpen ? 'translate-y-0' : 'translate-y-full'} max-h-[85vh] overflow-y-auto`}>
            
            <div className="w-12 h-1 bg-lumina-border rounded-full mx-auto mb-6 opacity-50" />
            
            <div className="grid gap-6">
              {/* Section: Master Data */}
              <div>
                <h3 className="text-xs font-bold text-lumina-muted uppercase tracking-widest mb-3">Master Data</h3>
                <div className="grid grid-cols-2 gap-3">
                  <MenuItem href="/products" label="Produk" iconD="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  <MenuItem href="/variants" label="Variants" iconD="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  <MenuItem href="/customers" label="Pelanggan" iconD="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                  <MenuItem href="/suppliers" label="Supplier" iconD="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </div>
              </div>

              {/* Section: Transactions */}
              <div>
                <h3 className="text-xs font-bold text-lumina-muted uppercase tracking-widest mb-3">Transaksi</h3>
                <div className="grid grid-cols-1 gap-3">
                   <MenuItem href="/transactions-history" label="Riwayat Penjualan" iconD="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                   <MenuItem href="/purchases" label="Pembelian (PO)" iconD="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                   <MenuItem href="/cash" label="Arus Kas" iconD="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </div>
              </div>

              {/* Section: System */}
              <div>
                <h3 className="text-xs font-bold text-lumina-muted uppercase tracking-widest mb-3">System</h3>
                <div className="grid grid-cols-2 gap-3">
                   <MenuItem href="/finance-accounts" label="Akun (COA)" iconD="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                   <MenuItem href="/settings" label="Pengaturan" iconD="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                   <MenuItem href="/warehouses" label="Gudang" iconD="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </>
  );
}