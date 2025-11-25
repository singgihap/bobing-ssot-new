// app/(dashboard)/layout.js

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MobileNav from "@/components/MobileNav";
// Tidak perlu import context karena sudah disediakan di app/layout.js

export default function DashboardLayout({ children }) {
  // Catatan: Jika Anda memiliki logika AuthGuard di sini, pertahankan.
  
  return (
    <div className="flex h-screen overflow-hidden bg-lumina-surface">
      {/* Desktop Sidebar */}
      <Sidebar /> 
      
      <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
         <Topbar />
         {/* Konten Utama */}
         <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 scroll-smooth relative scrollbar-hide">
           {children}
         </main>

         {/* Mobile Bottom Nav */}
         <MobileNav />
      </div>
    </div>
  );
}