// components/MobileNav.js

"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Portal } from '@/lib/usePortal';
import { navData, footerNav } from '@/lib/navData';
import { NavIcon, D_MONEY } from '@/components/DashboardIcons'; 
// Menggunakan warna semantik baru dari theme Tailwind
const TEXT_ACTIVE = 'text-text-primary'; // Dark text for light background
const BG_HOVER = 'bg-gray-100'; // Light gray highlight (Pengganti lumina-highlight)

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user || pathname === '/login') return null;

  const isActive = (path) => pathname === path || pathname.startsWith(path + '/');

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // Drawer Item Helper
  const DrawerItem = ({ href, label, iconD, description, onClick }) => (
    <Link 
      href={href}
      onClick={onClick}
      className={`flex items-center p-3 rounded-xl transition-all duration-200 
        ${isActive(href) 
            ? `${BG_HOVER} ${TEXT_ACTIVE} shadow-lg` 
            : `hover:${BG_HOVER} text-text-secondary` // text-lumina-muted -> text-text-secondary
        }
      `}
    >
      {/* Menggunakan NavIcon untuk SVG */}
      <div className='w-6 h-6 shrink-0 mr-4'>
          <NavIcon d={iconD} active={isActive(href)} size="w-6 h-6" />
      </div>

      <div>
        {/* text-lumina-muted -> text-text-secondary */}
        <p className={`text-sm font-semibold ${isActive(href) ? TEXT_ACTIVE : 'text-text-secondary'}`}>{label}</p>
        {/* text-lumina-muted/70 -> text-text-secondary/70 */}
        <p className="text-xs text-text-secondary/70">{description}</p>
      </div>
    </Link>
  );
  
  const D_DASH = navData[0].items.find(item => item.label === "Dashboard")?.iconD; 
  const D_POS = navData[0].items.find(item => item.label === "Point of Sales")?.iconD;

  return (
    <>
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* bg-lumina-base -> bg-surface, border-lumina-border -> border-border */}
      <div className={`fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-30 flex justify-around md:hidden`}>
        
        <Link href="/dashboard" className="flex flex-col items-center justify-center">
          <NavIcon d={D_DASH} active={isActive('/dashboard')} size="w-6 h-6" />
          {/* text-lumina-muted -> text-text-secondary */}
          <span className={`text-[10px] ${isActive('/dashboard') ? `${TEXT_ACTIVE} font-bold` : 'text-text-secondary'}`}>Home</span>
        </Link>
        
        <Link href="/sales/manual" className="flex flex-col items-center justify-center">
          <NavIcon d={D_POS} active={isActive('/sales/manual')} size="w-6 h-6" />
          <span className={`text-[10px] ${isActive('/sales/manual') ? `${TEXT_ACTIVE} font-bold` : 'text-text-secondary'}`}>POS</span>
        </Link>
        
        <button onClick={toggleMenu} className="flex flex-col items-center justify-center focus:outline-none">
          <NavIcon d="M4 6h16M4 12h16M4 18h16" active={isMenuOpen} size="w-6 h-6" />
          <span className={`text-[10px] ${isMenuOpen ? `${TEXT_ACTIVE} font-bold` : 'text-text-secondary'}`}>Menu</span>
        </button>

        <Link href="/finance" className="flex flex-col items-center justify-center">
          <NavIcon d={D_MONEY} active={isActive('/finance')} size="w-6 h-6" />
          <span className={`text-[10px] ${isActive('/finance') ? `${TEXT_ACTIVE} font-bold` : 'text-text-secondary'}`}>Finance</span>
        </Link>

        {/* Menggunakan data dari footerNav */}
        <Link href={footerNav.href} className="flex flex-col items-center justify-center">
          <NavIcon d={footerNav.iconD} active={isActive(footerNav.href)} size="w-6 h-6" />
          <span className={`text-[10px] ${isActive(footerNav.href) ? `${TEXT_ACTIVE} font-bold` : 'text-text-secondary'}`}>Settings</span>
        </Link>
      </div>

      {isMenuOpen && (
        <Portal>
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden" 
            onClick={toggleMenu}
          ></div>
          {/* bg-lumina-surface -> bg-surface, border-lumina-border -> border-border */}
          <div className="fixed top-0 right-0 w-full max-w-xs h-full bg-surface border-l border-border p-6 z-50 overflow-y-auto">
            
            {/* text-lumina-text -> text-text-primary */}
            <h2 className="text-xl font-bold text-text-primary mb-6">Navigation</h2>
            
            {/* RENDER DYNAMIC DARI navData */}
            {navData.map((category) => (
                <div key={category.title}>
                    {/* text-lumina-muted/50 -> text-text-secondary/50 */}
                    <h3 className="text-xs font-bold text-text-secondary/50 uppercase tracking-[0.2em] mt-6 mb-3">
                        {category.title}
                    </h3>
                    <div className="space-y-3">
                        {category.items.map((item) => (
                           <div key={item.href}>
                              {/* RENDER ITEM UTAMA */}
                              <DrawerItem 
                                href={item.href} 
                                label={item.label} 
                                description={item.description || `Ringkasan ${item.label}`}
                                iconD={item.iconD}
                                onClick={toggleMenu}
                              />
                              
                              {/* RENDER SUB ITEMS (JIKA ADA) */}
                              {item.subItems && (
                                <div className="ml-5 mt-2 space-y-2 border-l border-border/50 pl-3">
                                   {item.subItems.map((subItem) => (
                                      <Link
                                         key={subItem.href}
                                         href={subItem.href}
                                         onClick={toggleMenu}
                                         className={`block text-xs py-1.5 rounded-md transition-colors 
                                                     ${isActive(subItem.href) 
                                                        ? 'text-primary font-semibold' // text-lumina-gold -> text-primary
                                                        : 'text-text-secondary hover:text-text-primary' // text-lumina-muted -> text-text-secondary, hover:text-lumina-text -> hover:text-text-primary
                                                     }`}
                                      >
                                         — {subItem.label}
                                      </Link>
                                   ))}
                                </div>
                              )}
                           </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* FOOTER SETTINGS (Diambil dari footerNav) */}
            <h3 className="text-xs font-bold text-text-secondary/50 uppercase tracking-[0.2em] mt-6 mb-3">System</h3>
            <div className="space-y-3">
              <DrawerItem 
                href={footerNav.href} 
                label={footerNav.label} 
                description={footerNav.description}
                iconD={footerNav.iconD}
                onClick={toggleMenu}
              />
            </div>
            
          </div>
        </Portal>
      )}
    </>
  );
}