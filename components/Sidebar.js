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

   if (!user || pathname === '/login') return null;

   const isActive = (path) => pathname === path || pathname.startsWith(`${path}/`);

   const NavItem = ({ href, label, iconD }) => {
      const active = isActive(href);
      return (
          <Link 
             href={href} 
             className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative mx-3 my-1
                ${active 
                   ? "bg-primary/5 text-primary font-semibold" 
                   : "text-text-secondary hover:text-text-primary hover:bg-gray-50/80"
                } 
                ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
             title={isSidebarCollapsed ? label : ''}
          >
             {/* Icon */}
             <span className={`shrink-0 transition-colors duration-200 ${active ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                <NavIcon d={iconD} active={active} size="w-[20px] h-[20px]" />
             </span>
             
             {/* Label */}
             {!isSidebarCollapsed && (
                <span className="text-[13px] tracking-wide font-medium">{label}</span>
             )}
             
             {/* Active Indicator (Left Border Concept) */}
             {active && !isSidebarCollapsed && (
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-primary rounded-r-full"></div>
             )}
          </Link>
      );
   };

   const NavCategory = ({ title }) => (
      !isSidebarCollapsed && (
         <div className="px-6 mt-6 mb-2 text-[10px] font-bold text-text-secondary/50 uppercase tracking-widest font-display">
            {title}
         </div>
      )
   );

   return (
      <aside className={`bg-white border-r border-border font-sans z-40 hidden md:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'}`}>
         {/* HEADER */}
         <div className={`h-16 flex items-center shrink-0 transition-all ${isSidebarCollapsed ? 'justify-center' : 'px-6'}`}>
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <span className="font-display font-bold text-lg">B</span>
               </div>
               {!isSidebarCollapsed && (
                  <div className="animate-fade-in">
                     <h1 className="font-display font-bold text-text-primary text-base tracking-tight leading-none">Bobing</h1>
                     <p className="text-[9px] text-text-secondary font-medium mt-0.5">Enterprise System</p>
                  </div>
               )}
            </div>
         </div>

         {/* NAVIGATION */}
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

         {/* FOOTER USER / SETTINGS */}
         <div className="p-3 border-t border-border bg-gray-50/50"> 
            <Link href={footerNav.href} className={`flex items-center gap-3 p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:border border border-transparent hover:border-border transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                 <div className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center text-text-secondary shadow-sm">
                    <NavIcon d={footerNav.iconD} active={isActive(footerNav.href)} size="w-4 h-4" />
                 </div>
                 {!isSidebarCollapsed && (
                    <div className="overflow-hidden">
                       <p className="text-xs font-bold text-text-primary truncate">{footerNav.label}</p>
                       <p className="text-[10px] text-text-secondary truncate">{footerNav.description}</p>
                    </div>
                 )}
            </Link>
         </div>
      </aside>
   );
}