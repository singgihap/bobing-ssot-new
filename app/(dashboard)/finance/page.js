// app/(dashboard)/finance/page.js
// FILE DISESUAIKAN: Hanya berfungsi sebagai redirect ke default tab
import { redirect } from 'next/navigation';

/**
 * Halaman root untuk /finance.
 * Langsung mengarahkan pengguna ke halaman Accounts (/finance/accounts).
 */
export default function FinanceRootPage() {
  redirect('/finance/cash');
}