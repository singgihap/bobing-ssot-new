// components/Sidebar.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLayout } from '@/context/LayoutContext';
import { navData, footerNav } from '@/lib/navData'; // Import Data Navigasi
import { NavIcon } from '@/components/DashboardIcons'; // Import Komponen Ikon

export default function Sidebar() {
   const pathname = usePathname();
   const { user } = useAuth();
   const { isSidebarCollapsed } = useLayout();

   // Logika Hide/Show tetap ada
   if (!user || pathname === '/login') return null;

   // Fungsi pengecekan aktif: harus cocok dengan href (misalnya /catalog) atau sub-rute (/catalog/products)
   const isActive = (path) => pathname.startsWith(path);

   // Komponen NavItem yang disederhanakan
   const NavItem = ({ href, label, iconD }) => (
      <Link 
         href={href} 
         className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative mx-2 my-1
            ${isActive(href) 
               ? "bg-gradient-to-r from-lumina-gold/20 to-transparent border-l-4 border-lumina-gold text-lumina-text shadow-[0_0_20px_rgba(212,175,55,0.1)]" // Note: text-lumina-text untuk active state agar kontras dengan background terang
               // PERBAIKAN 1: Ganti hover:text-white & hover:bg-white/5 menjadi light mode classes
               : "text-lumina-muted hover:text-lumina-text hover:bg-lumina-highlight border-l-4 border-transparent"
            } 
            ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
         title={isSidebarCollapsed ? label : ''}
      >
         <span className={`shrink-0 text-xl transition-transform duration-300 ${isActive(href) ? 'scale-110 text-lumina-gold' : 'group-hover:scale-110'}`}>
            <NavIcon d={iconD} active={isActive(href)} />
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
                     {/* PERBAIKAN 2: Ganti text-white menjadi text-lumina-text */}
                     <h1 className="font-display font-bold text-lumina-text text-lg tracking-wide">Bobing</h1>
                     <p className="text-[9px] text-lumina-gold uppercase tracking-[0.2em] font-bold opacity-80">Enterprise</p>
                  </div>
               )}
            </div>
         </div>

         {/* NAVIGATION - DIRENDER DARI navData */}
         <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
            {navData.map((category) => (
               <div key={category.title}>
                  <NavCategory title={category.title} />
                  {category.items.map((item) => (
                     <NavItem 
                        key={item.href} 
                        href={item.href} 
                        label={item.label} 
                        iconD={item.iconD} 
                     />
                  ))}
               </div>
            ))}
        </nav>

         {/* FOOTER SETTINGS */}
      {/* Footer background sudah diperbaiki di langkah sebelumnya */}
         <div className="p-4 border-t border-lumina-border bg-lumina-highlight"> 
            <Link href={footerNav.href} className={`flex items-center gap-3 p-3 rounded-xl hover:bg-lumina-highlight/80 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                 <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lumina-muted">
                    {/* Menggunakan NavIcon untuk Settings */}
                    <NavIcon d={footerNav.iconD} active={isActive(footerNav.href)} />
                 </div>
                 {!isSidebarCollapsed && (
                    <div>
                       <p className="text-xs font-bold text-lumina-text">{footerNav.label}</p>
                       <p className="text-[9px] text-lumina-muted">{footerNav.description}</p>
                    </div>
                 )}
            </Link>
         </div>
      </aside>
   );
}