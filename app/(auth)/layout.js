// app/(auth)/layout.js

export default function AuthLayout({ children }) {
  return (
    // Hanya container minimal untuk halaman otentikasi
    <div className="min-h-screen flex items-center justify-center bg-background">
      {children}
    </div>
  );
}