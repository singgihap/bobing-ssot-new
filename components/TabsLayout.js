// components/TabsLayout.js
"use client";
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import PageHeader from './PageHeader';
import Skeleton from './Skeleton';

export default function TabsLayout({ tabs, defaultPath, pageTitle, pageSubtitle }) { 
  const pathname = usePathname();
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('');
  const [loading, setLoading] = useState(true);

  // --- LOGIKA UTAMA: Tentukan Tab Aktif & Lakukan Redirect HANYA jika diperlukan ---
  useEffect(() => {
    setLoading(true); // Mulai loading saat pathname berubah
    
    const matchedTab = tabs.find(t => t.path === pathname);
    
    if (matchedTab) {
      // 1. Path cocok dengan salah satu tab. Tetapkan sebagai aktif.
      setCurrentTab(matchedTab.path);
    } else if (pathname.endsWith('/catalog') || pathname.endsWith('/finance') /* tambahkan root group lainnya di sini */) {
      // 2. Path adalah root group (misal: /catalog). Redirect ke default.
      router.replace(defaultPath);
    } else {
      // 3. Path tidak cocok dan BUKAN root group. Cek apakah ini path yang benar-benar tidak dikenal.
      // Jika pathname BUKAN sub-path dari group ini, biarkan Next.js handle 404.
      // Jika pathname adalah sub-path dari group ini tetapi tidak cocok (misal: /catalog/xyz), redirect ke default.
      
      const isSubPath = pathname.startsWith(defaultPath.substring(0, defaultPath.lastIndexOf('/')));
      
      if (isSubPath) {
          router.replace(defaultPath);
      }
    }
    
    // Matikan loading setelah logika selesai
    setLoading(false);
    
  }, [pathname, router, tabs, defaultPath]);


  // Cari komponen untuk tab yang aktif/default
  // Pastikan menggunakan currentTab, atau defaultPath saat komponen pertama kali dimuat
  const Component = currentTab 
    ? tabs.find(t => t.path === currentTab)?.component 
    : tabs.find(t => t.path === defaultPath)?.component;
  

  const handleTabClick = (path) => {
    if (path !== currentTab) {
      router.push(path);
    }
  };

  if (loading || !currentTab) {
    return <Skeleton type="tabs" />;
  }
  
  // Pastikan Component ada sebelum merendernya
  if (!Component) {
      return (
          <PageHeader title={pageTitle} subtitle="Error: Component not found for current tab." />
      );
  }

  return (
    <>
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />
      
      {/* Tabs Rendering Logic (sudah benar dari refactor sebelumnya) */}
      <div className='flex space-x-4 border-b border-border/50'>
        {tabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => handleTabClick(tab.path)}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors duration-200
              ${currentTab === tab.path 
                ? 'text-text-primary border-b-2 border-primary' 
                : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent' 
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className='mt-8'>
        <Component />
      </div>
    </>
  );
}