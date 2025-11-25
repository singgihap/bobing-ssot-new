// app/(dashboard)/finance/layout.js (FILE BARU)
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

// --- DEFINISI DATA TAB ---
const FINANCE_TABS = [
    { path: "/finance/accounts", label: "Accounts" }, // Default Tab
    { path: "/finance/balance", label: "Balance" },
    { path: "/finance/cash", label: "Cash Flow" }, // Menggunakan Cash Flow untuk kejelasan
    { path: "/finance/reports", label: "Reports" },
];

export default function FinanceLayout({ children }) {
    const pathname = usePathname();
    
    // Fungsi pengecekan aktif: mencocokkan path secara parsial
    const isActive = (path) => pathname.startsWith(path);

    return (
        <>
            <PageHeader 
                title="Finance Hub" 
                subtitle="Manage accounts, track balance, monitor cash flow, and generate financial reports." 
            />
            
            {/* Tabs Navigation (UI yang PERSISTEN/PINNED) */}
            <div className='flex space-x-4 border-b border-border/50'>
                {FINANCE_TABS.map((tab) => (
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