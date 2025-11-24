// app/layout.js
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthContextProvider } from "../context/AuthContext";
import { LayoutProvider } from "../context/LayoutContext"; 
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MobileNav from "../components/MobileNav"; // Import Mobile Nav

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: '--font-jetbrains' });

export const metadata = { title: "Lumina ERP", description: "Luxury Command Center" };

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Rasa native app (disable zoom)
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} bg-lumina-base text-lumina-text font-sans`}>
        <AuthContextProvider>
          <LayoutProvider>
            <div className="flex h-screen overflow-hidden bg-lumina-base">
               {/* Desktop Sidebar */}
               <Sidebar /> 
               
               <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
                  <Topbar />
                  {/* Konten Utama: Tambah padding bottom di mobile agar tidak tertutup nav */}
                  <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 scroll-smooth relative scrollbar-hide">
                    {children}
                  </main>

                  {/* Mobile Bottom Nav */}
                  <MobileNav />
               </div>
            </div>
          </LayoutProvider>
        </AuthContextProvider>
      </body>
    </html>
  );
}