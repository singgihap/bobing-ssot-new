// app/(dashboard)/page.js

import { redirect } from 'next/navigation';

// Next.js akan secara otomatis menangani ini sebagai server component
// untuk mengarahkan pengguna yang mengakses URL root dashboard group (yang akan menjadi /)
// langsung ke halaman dashboard yang sebenarnya (/dashboard).
export default function DashboardGroupRootPage() {
  redirect('/dashboard');
  // Tidak perlu mengembalikan JSX, redirect akan mengurusnya.
}