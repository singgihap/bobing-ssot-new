// components/Topbar.js
"use client";
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Link from 'next/link';

export default function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { 
    setIsMobileMenuOpen, 
    isSidebarCollapsed, 
    setIsSidebarCollapsed 
  } = useLayout();

  // State untuk Dropdown Menu Profil
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Tutup dropdown jika klik di luar area
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user || pathname === '/login') return null;

  // Fungsi Logout (Dipindah ke dalam menu)
  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar sistem?")) {
      try {
        await signOut(auth);
      } catch (error) {
        alert("Gagal logout");
      }
    }
  };

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
        
        {/* 1. MOBILE HAMBURGER (Tetap Hamburger untuk Mobile) */}
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden p-2 text-lumina-muted hover:text-white rounded-lg hover:bg-lumina-highlight transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        {/* 2. DESKTOP TOGGLE (Arrow Kecil) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex p-1.5 text-lumina-muted hover:text-lumina-gold rounded-md hover:bg-lumina-highlight transition-colors border border-transparent hover:border-lumina-border"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {/* Logika Ikon Panah: Kiri (Tutup) atau Kanan (Buka) */}
          {isSidebarCollapsed ? (
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          ) : (
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          )}
        </button>

        {/* Divider Kecil */}
        <div className="h-6 w-px bg-lumina-border hidden md:block mx-1"></div>

        {/* Title */}
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

      {/* --- RIGHT AREA --- */}
      <div className="flex items-center gap-2 md:gap-5">
        
        {/* Search Bar (Desktop) */}
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

        <div className="h-6 w-px bg-lumina-border hidden md:block"></div>

        {/* USER PROFILE DROPDOWN */}
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 cursor-pointer group hover:bg-lumina-highlight/50 p-1.5 rounded-lg transition-all focus:outline-none"
            >
               <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-white group-hover:text-lumina-gold transition-colors">{user?.email?.split('@')[0]}</p>
                  <p className="text-[9px] text-lumina-muted uppercase tracking-wider">Admin</p>
               </div>
               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lumina-gold to-amber-600 p-[1px] shadow-gold-glow group-hover:shadow-lg transition-all">
                  <div className="w-full h-full rounded-lg bg-lumina-surface flex items-center justify-center">
                    <span className="text-xs font-bold text-white group-hover:text-lumina-gold transition-colors">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
               </div>
            </button>

            {/* Dropdown Menu */}
            {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-lumina-surface border border-lumina-border rounded-xl shadow-2xl py-1 animate-fade-in origin-top-right ring-1 ring-black/5 z-50">
                    <div className="px-4 py-2 border-b border-lumina-border mb-1">
                        <p className="text-xs text-white font-bold">Signed in as</p>
                        <p className="text-[10px] text-lumina-muted truncate">{user?.email}</p>
                    </div>
                    
                    <Link href="/settings" className="block px-4 py-2 text-xs text-lumina-text hover:bg-lumina-highlight hover:text-white transition-colors">
                        Settings
                    </Link>
                    <Link href="/profile" className="block px-4 py-2 text-xs text-lumina-text hover:bg-lumina-highlight hover:text-white transition-colors">
                        Your Profile
                    </Link>
                    
                    <div className="border-t border-lumina-border my-1"></div>
                    
                    <button 
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors font-bold"
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </div>

      </div>
    </header>
  );
}