// app/(dashboard)/sales/layout.js

"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

// --- DEFINISI DATA TAB ---
const SALES_TABS = [
    { path: "/sales/transactions", label: "Transactions" },
    { path: "/sales/customers", label: "Customers" },
    { path: "/sales/manual", label: "Manual POS" },
    { path: "/sales/import", label: "Import" },
];

export default function SalesLayout({ children }) {
    const pathname = usePathname();
    
    // Fungsi pengecekan aktif: mencocokkan path secara eksak (atau path root)
    const isActive = (path) => pathname === path || (path === "/sales" && pathname.startsWith("/sales/"));

    return (
        <>
            <PageHeader 
                title="Sales Center" 
                subtitle="Manage and track all sales transactions, customers, and data imports." 
            />
            
            {/* Tabs Navigation (UI yang PERSISTEN/PINNED) */}
            <div className='flex space-x-4 border-b border-border/50'>
                {SALES_TABS.map((tab) => (
                    <Link
                        key={tab.path}
                        href={tab.path}
                        className={`
                            flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors duration-200
                            ${isActive(tab.path) 
                                // Kelas yang sudah kita refactor
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