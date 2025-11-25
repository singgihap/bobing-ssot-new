// app/(auth)/layout.js

import '../globals.css'; // Sesuaikan jika Anda memindahkan globals.css

export default function AuthLayout({ children }) {
  // Anda bisa menambahkan elemen layout khusus untuk halaman otentikasi di sini,
  // seperti latar belakang sederhana atau logo.
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {children}
    </div>
  );
}
