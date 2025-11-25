// app/(dashboard)/sales/page.js

import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /sales (Ringkasan Penjualan).
 * Karena file ringkasan belum ada, kita mengarahkannya ke
 * halaman daftar utama Sales yang pertama, yaitu Sales Manual.
 */
export default function SalesRootPage() {
  // Mengarahkan ke sub-rute penjualan utama
  redirect('/sales/manual');
}
