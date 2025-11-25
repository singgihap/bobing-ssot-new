// components/TabsLayout.js
"use client";
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import PageHeader from './PageHeader';
import Skeleton from './Skeleton';

// PERBAIKAN: Hapus 'children' dari props.
export default function TabsLayout({ tabs, defaultPath, pageTitle, pageSubtitle }) { 
  const pathname = usePathname();
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('');
  const [loading, setLoading] = useState(true);

  // Set default tab on mount and update URL
  useEffect(() => {
    let activePath = pathname;

    // Jika pathname adalah path root tab group (e.g. /finance)
    // Arahkan ke defaultPath (e.g. /finance/accounts)
    if (tabs.some(tab => tab.path === pathname) && pathname !== defaultPath) {
      router.replace(defaultPath);
      activePath = defaultPath;
    }

    const matchedTab = tabs.find(t => t.path === activePath);
    if (matchedTab) {
      setCurrentTab(matchedTab.path);
    } else {
      // Ini memastikan kita selalu kembali ke default jika ada path yang tidak dikenal di grup ini
      setCurrentTab(defaultPath);
      router.replace(defaultPath);
    }

    setLoading(false);
  }, [pathname, router, tabs, defaultPath]);

  // Cari komponen untuk tab yang aktif/default
  const Component = currentTab 
    ? tabs.find(t => t.path === currentTab)?.component 
    : tabs.find(t => t.path === defaultPath)?.component;

  const handleTabClick = (path) => {
    if (path !== currentTab) {
      router.push(path);
    }
  };

  if (loading) {
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
      
      <div className='flex space-x-4 border-b border-lumina-border/50'>
        {tabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => handleTabClick(tab.path)}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors duration-200
              ${currentTab === tab.path 
                ? 'text-lumina-text border-b-2 border-lumina-gold' // PERBAIKAN 1: text-white -> text-lumina-text
                // PERBAIKAN 2: hover:text-white/80 -> hover:text-lumina-text
                : 'text-lumina-muted hover:text-lumina-text border-b-2 border-transparent' 
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