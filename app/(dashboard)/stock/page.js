// app/(dashboard)/stock/page.js

import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /stock.
 * Langsung mengarahkan pengguna ke halaman Inventory (/stock/inventory).
 */
export default function StockRootPage() {
  // Mengarahkan ke sub-rute utama stock
  redirect('/stock/inventory');
}
