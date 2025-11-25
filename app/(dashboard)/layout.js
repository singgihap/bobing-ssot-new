// app/(dashboard)/layout.js

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
// Asumsikan AuthContext dan AuthGuard ada
import { AuthContextProvider } from '@/context/AuthContext';
// Jika Anda menggunakan komponen AuthGuard, impor di sini.

export default function DashboardLayout({ children }) {
  return (
    <AuthContextProvider>
      {/* Anda mungkin perlu menyesuaikan penggunaan AuthGuard sesuai implementasi Anda */}
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-y-auto">
          <Topbar />
          <main className="flex-1 p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthContextProvider>
  );
}

// Catatan: Pastikan Path Import seperti '@/components/Sidebar' sudah sesuai dengan konfigurasi jsconfig.json Anda.
