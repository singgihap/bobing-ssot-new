// app/(dashboard)/catalog/products/create/page.js
"use client";
import React from 'react';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';

export default function CreateProductPage() {
  // Komponen Button Back sederhana
  const BackButton = () => (
      <Link 
          href="/catalog/products" 
          className="text-text-secondary hover:text-text-primary flex items-center gap-2 text-sm"
      >
          &larr; Kembali ke Daftar Produk
      </Link>
  );

  return (
    <>
      <PageHeader 
        title="Buat Produk Baru" 
        subtitle="Masukkan detail produk, varian, dan inventaris awal."
      >
        <BackButton />
      </PageHeader>
      
      {/* Container utama untuk formulir */}
      <div className="bg-surface p-6 rounded-xl shadow-lg border border-lumina-border">
          <h3 className="text-xl font-display font-bold text-text-primary mb-4">Detail Produk & Varian</h3>
          
          <p className="text-text-secondary">
            [Area Formulir Utama]
            Di sini kita bisa membagi input menjadi beberapa bagian (misalnya, Info Dasar, Harga, Deskripsi, Varian, Gambar, SEO).
          </p>
          
          {/* Contoh tombol Simpan */}
          <div className="mt-8 pt-4 border-t border-lumina-border flex justify-end">
             <button className="btn-gold">
                Simpan Produk
             </button>
          </div>
      </div>
    </>
  );
}