// app/(dashboard)/sales/layout.js

"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

// --- ICONS ---
import { ScrollText, Users, Store, UploadCloud } from 'lucide-react';

// --- DEFINISI DATA TAB ---
const SALES_TABS = [
    { 
        path: "/sales/transactions", 
        label: "Transactions", 
        icon: <ScrollText className="w-4 h-4" /> 
    },
    { 
        path: "/sales/customers", 
        label: "Customers", 
        icon: <Users className="w-4 h-4" /> 
    },
    { 
        path: "/sales/manual", 
        label: "Manual POS", 
        icon: <Store className="w-4 h-4" /> 
    },
    { 
        path: "/sales/import", 
        label: "Import", 
        icon: <UploadCloud className="w-4 h-4" /> 
    },
];

export default function SalesLayout({ children }) {
    const pathname = usePathname();
    
    // Fungsi pengecekan aktif: mencocokkan path secara eksak atau sub-path
    const isActive = (path) => pathname === path || pathname.startsWith(`${path}/`);

    return (
        <>
            <PageHeader 
                title="Sales Center" 
                subtitle="Manage transactions, customer CRM, POS terminal, and data import." 
            />
            
            {/* Tabs Navigation (UI yang PERSISTEN/PINNED) */}
            <div className='flex space-x-1 border-b border-border/60 mb-6 overflow-x-auto scrollbar-hide'>
                {SALES_TABS.map((tab) => {
                    const active = isActive(tab.path);
                    return (
                        <Link
                            key={tab.path}
                            href={tab.path}
                            className={`
                                flex items-center gap-2 py-3 px-4 text-sm font-bold transition-all duration-200 border-b-2 whitespace-nowrap
                                ${active
                                    ? 'text-primary border-primary bg-primary/5' 
                                    : 'text-text-secondary hover:text-text-primary border-transparent hover:bg-gray-50' 
                                }
                            `}
                        >
                            {/* Icon dengan warna yang menyesuaikan state */}
                            <span className={active ? "text-primary" : "text-text-secondary/70 group-hover:text-text-primary"}>
                                {tab.icon}
                            </span>
                            {tab.label}
                        </Link>
                    );
                })}
            </div>
            
            {/* Content Page (Children) */}
            <div className='mt-4 animate-fade-in'>
                {children}
            </div>
        </>
    );
}