"use client";
import { useState } from "react";
import ProductView from "@/components/master/ProductView";
import VariantView from "@/components/master/VariantView";
import BrandView from "@/components/master/BrandView";
import CategoryView from "@/components/master/CategoryView";
import { CubeIcon, TagIcon, BookmarkIcon, FolderIcon, PlusIcon } from "@heroicons/react/24/solid";

const tabIcons = {
  products: <CubeIcon className="w-5 h-5" />,
  variants: <TagIcon className="w-5 h-5" />,
  brands: <BookmarkIcon className="w-5 h-5" />,
  categories: <FolderIcon className="w-5 h-5" />,
};

export default function ProductHubPage() {
  const [activeTab, setActiveTab] = useState("products");

  const tabs = [
    { id: "products", label: "Produk", iconKey: "products", desc: "Parent" },
    { id: "variants", label: "Varian", iconKey: "variants", desc: "SKU" },
    { id: "brands", label: "Brand", iconKey: "brands", desc: "" },
    { id: "categories", label: "Kategori", iconKey: "categories", desc: "" },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-14 space-y-10">
      {/* HEADER */}
      <div className="flex flex-col gap-2 pb-2">
        <h2 className="text-3xl font-black text-brand-800 tracking-tight">Master Produk</h2>
        <p className="text-base text-brand-400">Manajemen Katalog Terpusat & Integratif</p>
      </div>

      {/* TABS + Floating Action */}
      <div className="flex justify-between items-center">
        <nav className="bg-white/80 border border-gray-100 rounded-2xl shadow flex gap-2 px-2 py-2 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-2 px-5 py-2 rounded-full font-medium text-base transition-all select-none
                  ${active ? "bg-gradient-to-r from-brand-50 to-brand-100 text-brand-700 shadow-lg ring-2 ring-brand-200" : "hover:bg-gray-50 text-gray-500"}
                `}
              >
                <span className={`transition ${active ? "scale-110" : "opacity-75 group-hover:opacity-100"}`}>{tabIcons[tab.iconKey]}</span>
                <span>{tab.label}</span>
                {tab.desc && (
                  <span className="ml-2 px-2 bg-gray-100 text-gray-400 text-xs rounded-full font-medium hidden sm:inline">{tab.desc}</span>
                )}
              </button>
            );
          })}
        </nav>
        <button
          className="ml-5 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 py-2 shadow-lg transition"
        >
          <PlusIcon className="w-4 h-4" /> <span className="font-semibold">Tambah Produk</span>
        </button>
      </div>

      {/* CONTENT */}
      <div className="card p-0 mt-2">
        {activeTab === "products" && <ProductView />}
        {activeTab === "variants" && <VariantView />}
        {activeTab === "brands" && <BrandView />}
        {activeTab === "categories" && <CategoryView />}
      </div>
    </main>
  );
}
