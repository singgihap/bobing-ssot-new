// app/layout.js

import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// KOREKSI: Gunakan AuthContextProvider (sesuai file asli Anda), bukan AuthProvider
import { AuthContextProvider } from "@/context/AuthContext";
import { LayoutProvider } from "@/context/LayoutContext";
import { PurchaseCartProvider } from "@/context/PurchaseCartContext"; 

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: '--font-jetbrains' }); 

export const metadata = { 
  title: "Bobing SSOT System", 
  description: "Enterprise Command Center" 
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
      <body className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} bg-background text-text-primary font-sans`}>
        {/* KOREKSI: Pastikan nama komponen ini AuthContextProvider */}
        <AuthContextProvider>
          <LayoutProvider>
            <PurchaseCartProvider>
              {children}
            </PurchaseCartProvider>
          </LayoutProvider>
        </AuthContextProvider>
      </body>
    </html>
  );
}