"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

// --- ICONS ---
import { Wallet, Landmark, ArrowRightLeft, PieChart } from 'lucide-react';

const FINANCE_TABS = [
    { path: "/finance/accounts", label: "Accounts", icon: <Landmark className="w-4 h-4"/> },
    { path: "/finance/cash", label: "Cash Flow", icon: <ArrowRightLeft className="w-4 h-4"/> },
    { path: "/finance/balance", label: "Balance Sheet", icon: <Wallet className="w-4 h-4"/> },
    { path: "/finance/reports", label: "P & L Report", icon: <PieChart className="w-4 h-4"/> },
];

export default function FinanceLayout({ children }) {
    const pathname = usePathname();
    const isActive = (path) => pathname.startsWith(path);

    return (
        <>
            <PageHeader 
                title="Finance Hub" 
                subtitle="Pusat kendali keuangan, arus kas, dan laporan akuntansi." 
            />
            
            {/* Tabs Navigation */}
            <div className='flex space-x-1 border-b border-border/60 mb-6 overflow-x-auto scrollbar-hide'>
                {FINANCE_TABS.map((tab) => {
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
                            <span className={active ? "text-primary" : "text-text-secondary/70 group-hover:text-text-primary"}>
                                {tab.icon}
                            </span>
                            {tab.label}
                        </Link>
                    );
                })}
            </div>
            
            <div className='mt-4 animate-fade-in'>
                {children}
            </div>
        </>
    );
}