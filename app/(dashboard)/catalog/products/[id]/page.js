// app/(dashboard)/catalog/products/[id]/page.js
"use client";
import React from 'react';
import PageHeader from '@/components/PageHeader';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ProductDetailPage({ params }) {
  const { id } = params; // Mengambil ID dari URL (e.g., /catalog/products/123 -> id = '123')

  return (
    <>
      <PageHeader 
        title={`Detail Produk ${id}`}
        subtitle={`Kelola informasi produk, varian, stok, dan riwayat pesanan untuk item #${id}.`}
      >
        <Link 
            href="/catalog/products" 
            className="text-lumina-muted hover:text-lumina-text flex items-center gap-2 text-sm"
        >
            &larr; Kembali ke Daftar Produk
        </Link>
      </PageHeader>

      {/* Container utama untuk detail */}
      <div className="bg-lumina-surface p-6 rounded-xl shadow-lg border border-lumina-border">
          <h3 className="text-xl font-display font-bold text-lumina-text mb-4">
             Area Tabular Detail Produk
          </h3>
          
          <p className="text-lumina-muted">
            [Area Detail]
            Gunakan Tabs/Accordion di sini untuk memisahkan: Info Dasar, Data Varian, Stok Gudang, dan Log Transaksi/History.
          </p>
      </div>
    </>
  );
}