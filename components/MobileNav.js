// components/MobileNav.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Portal } from '@/lib/usePortal';
import { navData, footerNav } from '@/lib/navData';
// FIX: Import D_DASH dan D_POS secara langsung agar tidak error jika navData berubah
import { NavIcon, D_MONEY, D_DASH, D_POS } from '@/components/DashboardIcons'; 

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user || pathname === '/login') return null;

  const isActive = (path) => pathname === path || pathname.startsWith(`${path}/`);
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // Komponen Helper untuk Item Navigasi Bawah
  const NavItem = ({ href, iconD, label, onClick }) => {
      const active = isActive(href);
      return (
        <Link href={href} onClick={onClick} className="flex flex-col items-center justify-center w-full h-full active:scale-95 transition-transform">
          <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-text-secondary'}`}>
             {/* Pastikan iconD selalu ada, jika tidak fallback ke null */}
             {iconD && <NavIcon d={iconD} active={active} size="w-6 h-6" />}
          </div>
          <span className={`text-[9px] mt-0.5 font-medium ${active ? 'text-primary' : 'text-text-secondary'}`}>{label}</span>
        </Link>
      );
  };

  // Komponen Helper untuk Item Drawer (Menu Samping)
  const DrawerItem = ({ href, label, iconD, description, onClick }) => {
      const active = isActive(href);
      return (
        <Link 
          href={href}
          onClick={onClick}
          className={`flex items-center p-3.5 rounded-2xl transition-all duration-200 mb-2 border 
            ${active 
                ? 'bg-primary/5 border-primary/20 shadow-sm' 
                : 'bg-white border-transparent hover:bg-gray-50'
            }
          `}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 shrink-0 ${active ? 'bg-white text-primary shadow-sm' : 'bg-gray-100 text-text-secondary'}`}>
              <NavIcon d={iconD} active={active} size="w-5 h-5" />
          </div>
          <div>
            <p className={`text-sm font-bold ${active ? 'text-text-primary' : 'text-text-primary'}`}>{label}</p>
            <p className="text-[10px] text-text-secondary">{description}</p>
          </div>
        </Link>
      );
  };

  return (
    <>
      {/* MOBILE BOTTOM BAR (GLASSMORPHISM) */}
      <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-white/90 backdrop-blur-lg border-t border-border z-30 flex justify-between items-center px-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)] md:hidden">
        {/* Menggunakan D_DASH yang diimport langsung */}
        <NavItem href="/dashboard" iconD={D_DASH} label="Home" />
        
        {/* Menggunakan D_POS yang diimport langsung */}
        <NavItem href="/sales/manual" iconD={D_POS} label="POS" />
        
        {/* Center Menu Button (Floating Look) */}
        <div className="relative -top-5">
            <button onClick={toggleMenu} className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/30 active:scale-95 transition-transform border-4 border-white">
                <NavIcon d="M4 6h16M4 12h16M4 18h16" active={true} size="w-6 h-6" />
            </button>
        </div>

        <NavItem href="/finance" iconD={D_MONEY} label="Finance" />
        <NavItem href={footerNav.href} iconD={footerNav.iconD} label="System" />
      </div>

      {/* FULLSCREEN DRAWER MENU */}
      {isMenuOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={toggleMenu}></div>
          
          <div className="fixed inset-x-0 bottom-0 max-h-[85vh] bg-background rounded-t-[2rem] z-50 overflow-y-auto pb-24 shadow-2xl animate-slide-up md:hidden">
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm p-6 border-b border-border z-10 flex justify-between items-center">
                <h2 className="text-xl font-display font-bold text-text-primary">Main Menu</h2>
                <button onClick={toggleMenu} className="p-2 bg-gray-100 rounded-full text-text-secondary hover:bg-gray-200 transition-colors">
                    <NavIcon d="M6 18L18 6M6 6l12 12" size="w-5 h-5"/>
                </button>
            </div>
            
            <div className="p-6 pt-2">
                {navData.map((category) => (
                    <div key={category.title} className="mb-6">
                        <h3 className="text-xs font-bold text-text-secondary/50 uppercase tracking-widest mb-3 px-2">
                            {category.title}
                        </h3>
                        {category.items.map((item) => (
                           <DrawerItem 
                                key={item.href}
                                href={item.href} 
                                label={item.label} 
                                description={item.description}
                                iconD={item.iconD}
                                onClick={toggleMenu}
                           />
                        ))}
                    </div>
                ))}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}