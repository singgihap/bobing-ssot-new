"use client";
import { createContext, useContext, useState, useEffect } from "react";

const LayoutContext = createContext({});

export const useLayout = () => useContext(LayoutContext);

export const LayoutProvider = ({ children }) => {
  // Mobile: Sidebar Open/Close
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Desktop: Sidebar Expanded/Collapsed (Mini)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Tutup menu mobile saat layar diperbesar ke desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <LayoutContext.Provider 
      value={{ 
        isMobileMenuOpen, 
        setIsMobileMenuOpen, 
        isSidebarCollapsed, 
        setIsSidebarCollapsed 
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};