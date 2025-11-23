"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "../context/AuthContext";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  const redirectMessage = loading
    ? "Menginisialisasi akun..."
    : user
    ? "Selamat datang kembali!"
    : "Mengalihkan ke login…";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-slate-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 transition">
      <div className="text-center text-slate-400">
        <div className="mx-auto mb-5 flex items-center justify-center">
          {/* Brand Spinner with Gradient */}
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-brand-500 border-opacity-80 bg-white/30 shadow-md"></div>
          {/* Bisa tambah logo di tengah */}
          {/* <span className="absolute inset-0 flex items-center justify-center font-bold text-brand-600">B</span> */}
        </div>
        <p className="text-base font-semibold text-brand-500 animate-pulse">{redirectMessage}</p>
        <p className="text-xs text-slate-400 mt-1">Tunggu sebentar, sedang redirect otomatis…</p>
      </div>
    </div>
  );
}
