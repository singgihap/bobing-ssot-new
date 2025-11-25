// app/(dashboard)/catalog/page.js

import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /catalog.
 * Langsung mengarahkan pengguna ke halaman daftar produk (/catalog/products).
 */
export default function CatalogRootPage() {
  // Mengarahkan ke sub-rute utama katalog
  redirect('/catalog/products');
}
