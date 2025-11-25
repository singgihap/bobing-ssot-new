// context/AuthContext.js
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
// Menggunakan Path Alias agar lebih kuat (opsional, tapi disarankan)
import { auth } from "@/lib/firebase"; 
import { useRouter } from "next/navigation";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // TAMPILAN LOADING MEWAH (Lumina Theme)
  if (loading) {
    return (
      // PERUBAHAN 1: Ubah background gelap menjadi warna terang (bg-lumina-base)
      <div className="flex min-h-screen items-center justify-center bg-lumina-base"> 
        <div className="text-center relative">
          {/* Spinner Emas */}
          <div className="w-16 h-16 relative mx-auto mb-4">
            {/* PERUBAHAN 2: Ubah border gelap menjadi border-lumina-surface (warna terang) */}
            <div className="absolute inset-0 rounded-full border-4 border-lumina-surface"></div> 
            <div className="absolute inset-0 rounded-full border-t-4 border-lumina-gold animate-spin shadow-[0_0_15px_rgba(212,175,55,0.5)]"></div>
          </div>
          
          {/* Teks */}
          {/* PERUBAHAN 3: Ubah teks putih menjadi teks lumina-text (gelap) */}
          <h2 className="text-lg font-bold text-lumina-text tracking-widest font-display animate-pulse"> 
            Bobing Enterprise
          </h2>
            <p className="text-xs text-lumina-muted mt-1">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};