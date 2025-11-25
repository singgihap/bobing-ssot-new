// app/(dashboard)/catalog/page.js (FILE DISESUAIKAN)
import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /catalog.
 * Langsung mengarahkan pengguna ke halaman daftar produk (/catalog/products).
 * Note: Redirect ini hanya berjalan jika URL benar-benar /catalog.
 */
export default function CatalogRootPage() {
    // Mengarahkan ke sub-rute utama katalog
    redirect('/catalog/products');
}