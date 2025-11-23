// context/AuthContext.js
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
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
      <div className="flex min-h-screen items-center justify-center bg-[#0B0C10]">
        <div className="text-center relative">
           {/* Spinner Emas */}
           <div className="w-16 h-16 relative mx-auto mb-4">
             <div className="absolute inset-0 rounded-full border-4 border-[#12141C]"></div>
             <div className="absolute inset-0 rounded-full border-t-4 border-[#D4AF37] animate-spin shadow-[0_0_15px_rgba(212,175,55,0.5)]"></div>
           </div>
           
           {/* Teks */}
           <h2 className="text-lg font-bold text-white tracking-widest font-display animate-pulse">
             LUMINA
           </h2>
           <p className="text-[10px] text-[#94A3B8] mt-2 font-mono uppercase tracking-wider">
             Initializing System...
           </p>
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