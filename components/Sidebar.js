// components/Sidebar.js
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLayout } from '@/context/LayoutContext';
import { navData, footerNav } from '@/lib/navData'; 
import { NavIcon } from '@/components/DashboardIcons'; 

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
               // STATE AKTIF: Menggunakan primary (Biru Vibrant) sebagai warna aksen utama.
               ? "bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary text-text-primary shadow-[0_0_20px_rgba(37,99,235,0.1)]" 
               // STATE INAKTIF: Menggunakan border, text-secondary, dan hover:bg-gray-100 (pengganti lumina-highlight).
               : "text-text-secondary hover:text-text-primary hover:bg-gray-100 border-l-4 border-transparent"
            } 
            ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
         title={isSidebarCollapsed ? label : ''}
      >
         {/* Ikon: Menggunakan primary (Biru Vibrant) saat aktif */}
         <span className={`shrink-0 text-xl transition-transform duration-300 ${isActive(href) ? 'scale-110 text-primary' : 'group-hover:scale-110'}`}>
            <NavIcon d={iconD} active={isActive(href)} />
         </span>
         
         {!isSidebarCollapsed && (
            <span className="text-sm font-medium tracking-wide whitespace-nowrap">{label}</span>
         )}
      </Link>
   );

   const NavCategory = ({ title }) => (
      !isSidebarCollapsed && (
         <div className="px-6 mt-6 mb-2 text-[10px] font-bold text-text-secondary/40 uppercase tracking-[0.2em] font-display">
            {title}
         </div>
      )
   );

   return (
      <aside className={`bg-surface border-r border-border font-sans z-40 hidden md:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
         {/* HEADER */}
         <div className={`h-20 flex items-center shrink-0 transition-all ${isSidebarCollapsed ? 'justify-center' : 'px-6'}`}>
            <div className="flex items-center gap-3">
               {/* LOGO: Gradient Biru (primary) ke Ungu (accent) */}
               <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                  <span className="font-display font-bold text-xl">B</span>
               </div>
               {!isSidebarCollapsed && (
                  <div className="fade-in">
                     {/* Text: text-text-primary (Slate/Navy) */}
                     <h1 className="font-display font-bold text-text-primary text-lg tracking-wide">Bobing</h1>
                     {/* Tagline: text-primary (Biru Vibrant) */}
                     <p className="text-[9px] text-primary uppercase tracking-[0.2em] font-bold opacity-80">Enterprise</p>
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
         {/* Border: border-border, Background: bg-gray-100 */}
         <div className="p-4 border-t border-border bg-gray-100"> 
            {/* hover:bg-gray-100/80 */}
            <Link href={footerNav.href} className={`flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100/80 transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                 <div className="w-8 h-8 rounded-full bg-surface/50 flex items-center justify-center text-text-secondary">
                    {/* Menggunakan NavIcon untuk Settings */}
                    <NavIcon d={footerNav.iconD} active={isActive(footerNav.href)} />
                 </div>
                 {!isSidebarCollapsed && (
                    <div>
                       {/* Text: text-text-primary */}
                       <p className="text-xs font-bold text-text-primary">{footerNav.label}</p>
                       {/* Text: text-text-secondary */}
                       <p className="text-[9px] text-text-secondary">{footerNav.description}</p>
                    </div>
                 )}
            </Link>
         </div>
      </aside>
   );
}