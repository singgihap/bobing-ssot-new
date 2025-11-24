// app/page.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Pindahkan logic redirect ke sini untuk mencegah flash content
    if (!loading) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  const redirectMessage = loading
    ? "Initializing System..."
    : user
    ? "Access Granted. Redirecting..."
    : "Redirecting to Login...";

  return (
    <div className="flex min-h-screen items-center justify-center bg-lumina-base relative overflow-hidden font-sans">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lumina-gold/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="text-center relative z-10">
        {/* Luxury Spinner */}
        <div className="mx-auto mb-8 flex items-center justify-center relative w-16 h-16">
          {/* Track Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-lumina-surface"></div>
          {/* Gold Spinner Ring */}
          <div className="absolute inset-0 rounded-full border-t-4 border-lumina-gold animate-spin shadow-gold-glow"></div>
          {/* Logo */}
          <span className="font-display font-bold text-xl text-lumina-gold">B</span>
        </div>

        {/* Status Messages */}
        <h2 className="text-lg font-medium text-white tracking-wide animate-pulse">
          {redirectMessage}
        </h2>
        <p className="text-xs text-lumina-muted mt-2 font-mono opacity-70">
          Please wait while we load your workspace...
        </p>
      </div>
    </div>
  );
}