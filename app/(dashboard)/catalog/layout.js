// app/(dashboard)/catalog/layout.js

"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

// --- DEFINISI DATA TAB (Dipindahkan dari page.js) ---
const CATALOG_TABS = [
    { path: "/catalog/products", label: "Products" },
    { path: "/catalog/variants", label: "Variants" },
    { path: "/catalog/categories", label: "Categories" },
    { path: "/catalog/brands", label: "Brands" },
    { path: "/catalog/import", label: "Import" },
];

export default function CatalogLayout({ children }) {
    const pathname = usePathname();
    // Menggunakan startsWith untuk mencocokkan sub-rute secara agresif
    const isActive = (path) => pathname.startsWith(path) && (pathname.length === path.length || pathname[path.length] === '/');
    
    return (
        <>
            <PageHeader 
                title="Catalog Management" 
                subtitle="Manage products, variants, categories, and brands." 
            />
            
            {/* Tabs Navigation (UI yang PERSISTEN/PINNED) */}
            <div className='flex space-x-4 border-b border-border/50'>
                {CATALOG_TABS.map((tab) => (
                    <Link
                        key={tab.path}
                        href={tab.path}
                        className={`
                            flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors duration-200
                            ${isActive(tab.path) 
                                // Kelas yang sudah kita refactor (primary dan border)
                                ? 'text-text-primary border-b-2 border-primary' 
                                : 'text-text-secondary hover:text-primary border-b-2 border-transparent' 
                            }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>
            
            {/* Content Page (Dirender oleh Next.js Router) */}
            <div className='mt-8'>
                {children}
            </div>
        </>
    );
}