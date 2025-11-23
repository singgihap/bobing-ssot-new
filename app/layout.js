// app/layout.js
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthContextProvider } from "../context/AuthContext";
import { LayoutProvider } from "../context/LayoutContext"; // Import baru
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: '--font-jetbrains' });

export const metadata = { title: "Lumina ERP", description: "Luxury Command Center" };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} bg-lumina-base text-lumina-text font-sans`}>
        <AuthContextProvider>
          <LayoutProvider> {/* Provider Layout */}
            <div className="flex h-screen overflow-hidden bg-lumina-base">
               <Sidebar /> 
               <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
                  <Topbar />
                  <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 scroll-smooth relative">
                    {children}
                  </main>
               </div>
            </div>
          </LayoutProvider>
        </AuthContextProvider>
      </body>
    </html>
  );
}