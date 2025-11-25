// components/Topbar.js
"use client";
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Link from 'next/link';

// Asumsi getTitle sudah didefinisikan di suatu tempat atau di dalam Topbar.js
const getTitle = (pathname) => {
    // Implementasi sederhana untuk mendapatkan judul dari path
    const path = pathname.split('/').filter(p => p);
    if (path.length === 0) return "Home";
    
    // Menggunakan navData untuk judul penuh sangat disarankan, tapi untuk saat ini, kita ambil dari path
    const mainPath = path[0]; 
    return mainPath.charAt(0).toUpperCase() + mainPath.slice(1);
}

export default function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { 
    isSidebarCollapsed, 
    setIsSidebarCollapsed 
  } = useLayout();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar sistem?")) {
      try {
        await signOut(auth);
      } catch (error) {
        alert("Gagal logout");
      }
    }
  };

  return (
    // HEADER: Mengganti bg-lumina-base & border-lumina-border
    <header className="sticky top-0 z-10 w-full flex items-center h-14 md:h-16 px-4 md:px-6 flex items-center justify-between z-20 shrink-0 transition-all duration-300 bg-surface border-b border-border"> 
      
      {/* --- LEFT AREA --- */}
      <div className="flex items-center gap-3 md:gap-4">
        
        {/* Mobile Logo: Mengganti gradien Gold ke gradien Biru/Ungu */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-primary to-accent rounded flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]">
             <span className="font-display font-bold text-sm">B</span>
          </div>
        </div>

        {/* Desktop Toggle: Mengganti lumina-muted/gold/highlight/border */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex p-1.5 text-text-secondary hover:text-primary rounded-md hover:bg-gray-100 transition-colors border border-transparent hover:border-border"
        >
          {isSidebarCollapsed ? (
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          ) : (
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          )}
        </button>

        {/* Separator: Mengganti bg-lumina-border */}
        <div className="h-6 w-px bg-border hidden md:block mx-1"></div>

        {/* Title: Mengganti lumina-muted/gold/text */}
        <div className="flex flex-col justify-center">
            <div className="hidden md:flex items-center text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">
                <span className="text-primary mr-2">App</span>
                <span>/ {pathname.split('/')[1] || 'home'}</span>
            </div>
            <h2 className="text-base md:text-lg font-display font-bold text-text-primary tracking-wide leading-none truncate max-w-[200px] md:max-w-none">
            {getTitle(pathname)}
            </h2>
        </div>
      </div>

      {/* --- RIGHT AREA --- */}
      <div className="flex items-center gap-2 md:gap-5">
        
        {/* Search Bar: Mengganti lumina-surface/border/gold/muted/text */}
        <div className="hidden md:flex items-center bg-surface border border-border rounded-lg px-3 py-1.5 w-64 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-inner">
          <svg className="w-4 h-4 text-text-secondary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" placeholder="Quick search..." className="bg-transparent text-xs outline-none w-full text-text-primary placeholder-text-secondary/50 font-mono" />
          <span className="text-[9px] text-text-secondary border border-border px-1 rounded bg-surface">⌘K</span>
        </div>
        
        {/* Notification Bell: Mengganti lumina-muted/gold/base */}
        <button className="relative p-2 text-text-secondary hover:text-primary transition-colors group hidden md:block">
           <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full ring-1 ring-surface group-hover:animate-ping"></span>
           <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full ring-1 ring-surface"></span>
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        </button>

        {/* Separator: Mengganti bg-lumina-border */}
        <div className="h-6 w-px bg-border hidden md:block"></div>

        {/* USER PROFILE DROPDOWN */}
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                // Mengganti hover:bg-lumina-highlight/50
                className="flex items-center gap-3 cursor-pointer group hover:bg-gray-100/50 p-1.5 rounded-lg transition-all focus:outline-none"
            >
               <div className="text-right hidden sm:block">
                  {/* Mengganti text-lumina-text dan group-hover:text-lumina-gold */}
                  <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">{user?.email?.split('@')[0]}</p>
                  {/* Mengganti text-lumina-muted */}
                  <p className="text-[9px] text-text-secondary uppercase tracking-wider">Admin</p>
                </div>
                {/* Logo User: Mengganti gradien Gold ke Biru/Ungu dan shadow-gold-glow */}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent p-[1px] shadow-[0_0_15px_rgba(37,99,235,0.3)] group-hover:shadow-lg transition-all">
                  {/* Mengganti bg-lumina-surface */}
                  <div className="w-full h-full rounded-lg bg-surface flex items-center justify-center">
                    {/* Mengganti text-lumina-text dan group-hover:text-lumina-gold */}
                    <span className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
            </button>

            {/* Dropdown Menu */}
            {isProfileOpen && (
                // Mengganti bg-lumina-surface dan border-lumina-border
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl py-1 animate-fade-in origin-top-right ring-1 ring-black/5 z-50">
                    <div className="px-4 py-2 border-b border-border mb-1 block sm:hidden">
                        {/* Mengganti text-lumina-text */}
                        <p className="text-xs text-text-primary font-bold">{user?.email}</p>
                    </div>
                    
                    {/* Mengganti text-lumina-text dan hover:bg-lumina-highlight */}
                    <Link href="/settings" className="block px-4 py-2 text-xs text-text-primary hover:bg-gray-100 hover:text-text-primary transition-colors">
                        Settings
                    </Link>
                    
                    {/* Mengganti border-lumina-border */}
                    <div className="border-t border-border my-1"></div>
                    
                    <button 
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 transition-colors font-bold"
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