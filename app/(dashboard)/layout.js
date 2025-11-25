// app/(dashboard)/layout.js

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import MobileNav from '@/components/MobileNav';

export default function DashboardLayout({ children }) {
  return (
    // Container utama menggunakan flex untuk Sidebar dan Main Content
    <div className="flex w-full"> 
      
      {/* 1. Sidebar (Desktop View) */}
      <Sidebar />

      {/* 2. Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        
        {/* Topbar (Sticky Header) */}
        <Topbar />
        
        {/* Content Children Area */}
        {/* Background sudah diatur oleh app/layout.js (bg-background) */}
        <div className="p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
          {children}
        </div>
        
      </main>

      {/* 3. Mobile Nav (Bottom Bar) */}
      <MobileNav />
    </div>
  );
}