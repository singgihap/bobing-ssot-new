// app/(dashboard)/stock/page.js
// FILE DISESUAIKAN: Hanya berfungsi sebagai redirect ke default tab
import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /stock.
 * Langsung mengarahkan pengguna ke halaman Inventory (/stock/inventory).
 */
export default function StockRootPage() {
  redirect('/stock/inventory');
}