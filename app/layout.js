// app/layout.js

import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthContextProvider } from "@/context/AuthContext";
import { LayoutProvider } from "@/context/LayoutContext"; 
// Hapus import Sidebar, Topbar, dan MobileNav di sini

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });
// Menggunakan nama variabel yang Anda berikan
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: '--font-jetbrains' }); 

export const metadata = { 
  title: "Bobing SSOT System", // Diperbarui dari Lumina ERP
  description: "Enterprise Command Center" // Diperbarui dari Luxury Command Center
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      {/* KOREKSI: Mengganti bg-surface menjadi bg-background untuk latar belakang halaman global */}
      <body className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} bg-background text-text-primary font-sans`}>
        {/* AuthContext dan LayoutProvider adalah GLOBAL dan tetap di sini */}
        <AuthContextProvider>
          <LayoutProvider>
            {/* CHILDREN adalah Layout selanjutnya ((auth) atau (dashboard)) */}
            {children} 
          </LayoutProvider>
        </AuthContextProvider>
      </body>
    </html>
  );
}