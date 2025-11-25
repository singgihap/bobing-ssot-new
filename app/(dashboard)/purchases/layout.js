// app/(dashboard)/purchases/layout.js (FILE BARU)
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

// --- DEFINISI DATA TAB ---
const PURCHASE_TABS = [
    { path: "/purchases/overview", label: "Overview" },
    { path: "/purchases/suppliers", label: "Suppliers" },
    { path: "/purchases/import", label: "Import" },
];

export default function PurchasesLayout({ children }) {
    const pathname = usePathname();
    
    // Fungsi pengecekan aktif: mencocokkan path secara eksak atau mencocokkan path root (untuk Overview)
    const isActive = (path) => pathname === path || (path === "/purchases" && pathname === "/purchases");

    return (
        <>
            <PageHeader 
                title="Purchases Hub" 
                subtitle="Manage suppliers, track purchase orders, and import data." 
            />
            
            {/* Tabs Navigation (UI yang PERSISTEN/PINNED) */}
            <div className='flex space-x-4 border-b border-border/50'>
                {PURCHASE_TABS.map((tab) => (
                    <Link
                        key={tab.path}
                        href={tab.path}
                        className={`
                            flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors duration-200
                            ${(tab.path === "/purchases" ? pathname === "/purchases" : pathname.startsWith(tab.path)) 
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