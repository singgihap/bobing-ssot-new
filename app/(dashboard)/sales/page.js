// app/(dashboard)/sales/page.js
// FILE DISESUAIKAN: Hanya berfungsi sebagai redirect ke default tab
import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /sales.
 * Langsung mengarahkan pengguna ke halaman daftar utama (Transactions).
 */
export default function SalesRootPage() {
  // Mengarahkan ke sub-rute penjualan utama
  redirect('/sales/transactions');
}