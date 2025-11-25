// app/(dashboard)/purchases/page.js
// FILE DISESUAIKAN: Hanya berfungsi sebagai redirect ke default tab
import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /purchases.
 * Langsung mengarahkan pengguna ke halaman daftar pemasok (/purchases/suppliers).
 */
export default function PurchasesRootPage() {
  redirect('/purchases/suppliers');
}