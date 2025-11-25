// lib/navData.js

// Import SVG paths dari file DashboardIcons.jsx (asumsi Anda memindahkannya)
// Jika Anda tidak memindahkannya, pastikan file ini ada di components/DashboardIcons.jsx
import { 
    D_DASH, D_POS, D_CATALOG, D_STOCK, D_PURCHASES, D_MONEY,
    D_MASTER, D_OPS, D_PARTNER, D_SETTINGS 
} from '@/components/DashboardIcons'; 

// Struktur data navigasi
export const navData = [
  {
    title: "Main Menu",
    items: [
      { href: "/dashboard", label: "Dashboard", iconD: D_DASH },
    ]
  },
  {
    title: "Business Flow",
    items: [
      { 
        href: "/catalog", 
        label: "Catalog", 
        iconD: D_CATALOG,
        subItems: [
          { href: "/catalog/products", label: "Products" },
          { href: "/catalog/variants", label: "Variants" },
          { href: "/catalog/categories", label: "Categories" },
          { href: "/catalog/brands", label: "Brands" },
          { href: "/catalog/import", label: "Import Products" },
        ]
      },
      { 
        href: "/stock", 
        label: "Stock", 
        iconD: D_STOCK,
        subItems: [
          { href: "/stock/inventory", label: "Inventory" },
          { href: "/stock/warehouses", label: "Warehouses" },
          { href: "/stock/supplier-sessions", label: "Supplier Sessions" },
        ]
      },
      { 
        href: "/purchases", 
        label: "Purchases", 
        iconD: D_PURCHASES,
        subItems: [
          { href: "/purchases", label: "Overview" },
          { href: "/purchases/suppliers", label: "Suppliers" },
          { href: "/purchases/import", label: "Import Purchases" },
        ]
      },
      { 
        href: "/sales", 
        label: "Sales", 
        iconD: D_POS, // Menggunakan POS sebagai ikon utama Sales
        subItems: [
          { href: "/sales/manual", label: "Manual Sales" },
          { href: "/sales/import", label: "Import Sales" },
          { href: "/sales/transactions", label: "Transactions History" }, // Sesuai koreksi
          { href: "/sales/customers", label: "Customers" },
        ]
      },
    ]
  },
  {
    title: "Accounting",
    items: [
      { 
        href: "/finance", 
        label: "Finance", 
        iconD: D_MONEY,
        subItems: [
          { href: "/finance", label: "Overview" },
          { href: "/finance/accounts", label: "Accounts" },
          { href: "/finance/balance", label: "Balance" },
          { href: "/finance/reports", label: "Reports" },
          { href: "/finance/cash", label: "Cash" },
        ]
      },
    ]
  },
  // Settings tidak dimasukkan di sini karena biasanya ditangani di footer sidebar
];

// Data untuk footer (Settings)
export const footerNav = {
  href: "/settings", 
  label: "Settings", 
  description: "System Config",
  iconD: D_SETTINGS 
};