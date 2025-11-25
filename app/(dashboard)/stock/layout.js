// app/(dashboard)/stock/layout.js (FILE BARU)
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

// --- DEFINISI DATA TAB ---
const STOCK_TABS = [
    { path: "/stock/inventory", label: "Inventory" }, // Default Tab
    { path: "/stock/warehouses", label: "Warehouses" },
    { path: "/stock/supplier-sessions", label: "Supplier Sessions" },
];

export default function StockLayout({ children }) {
    const pathname = usePathname();
    
    // Fungsi pengecekan aktif: mencocokkan path secara parsial, karena tab root adalah halaman terpisah
    const isActive = (path) => pathname.startsWith(path);

    return (
        <>
            <PageHeader 
                title="Stock & Inventory Hub" 
                subtitle="Manage stock levels, view inventory location, and track supplier activities." 
            />
            
            {/* Tabs Navigation (UI yang PERSISTEN/PINNED) */}
            <div className='flex space-x-4 border-b border-border/50'>
                {STOCK_TABS.map((tab) => (
                    <Link
                        key={tab.path}
                        href={tab.path}
                        className={`
                            flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors duration-200
                            ${isActive(tab.path) 
                                // Kelas yang sudah kita refactor: text-primary untuk aktif
                                ? 'text-text-primary border-b-2 border-primary' 
                                : 'text-text-secondary hover:text-primary border-b-2 border-transparent' 
                            }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>
            
            {/* Content Page (Children) */}
            <div className='mt-8'>
                {children}
            </div>
        </>
    );
}