"use client";
import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // Redirect jika sudah login
  useEffect(() => { 
    if (user) router.push('/dashboard'); 
  }, [user, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Note: Auth operations are free (do not consume Firestore Reads)
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error) {
      alert("Login gagal: Periksa email/password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lumina-base px-4 font-sans">
      {/* Efek Glow Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-lumina-gold/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-sm bg-lumina-surface rounded-2xl shadow-2xl border border-lumina-border p-8 fade-in-up relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-lumina-gold to-[#F6C945] rounded-xl flex items-center justify-center text-black shadow-gold-glow mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-display">Welcome back</h2>
          <p className="text-sm text-lumina-muted mt-2">Masuk ke Bobing Command Center</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-lumina-muted mb-1.5 uppercase tracking-wide">Email</label>
            <input 
              type="email" 
              required 
              className="input-luxury bg-lumina-base/50" 
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-lumina-muted mb-1.5 uppercase tracking-wide">Password</label>
            <input 
              type="password" 
              required 
              className="input-luxury bg-lumina-base/50" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="w-full btn-gold py-3 text-sm shadow-gold-glow">
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : 'Sign in'}
          </button>
        </form>
      </div>
      <p className="mt-8 text-xs text-lumina-muted opacity-50 relative z-10">© 2025 Bobing SSOT System. All rights reserved.</p>
    </div>
  );
}