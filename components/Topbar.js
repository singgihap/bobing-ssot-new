// components/Topbar.js
"use client";
import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation'; // Tambah useRouter
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase'; // Tambah db
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc,
  where 
} from 'firebase/firestore'; // Import Firestore
import Link from 'next/link';
import { Bell, Check, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'; // Gunakan Lucide icons jika ada, atau SVG bawaan

const getTitle = (pathname) => {
    const path = pathname.split('/').filter(p => p);
    if (path.length === 0) return "Home";
    const mainPath = path[0]; 
    return mainPath.charAt(0).toUpperCase() + mainPath.slice(1);
}

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useLayout();

  // --- STATE NOTIFIKASI ---
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const dropdownRef = useRef(null);
  const notifRef = useRef(null); // Ref baru untuk notifikasi

  // --- 1. CLICK OUTSIDE HANDLER ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Handle Profile Dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      // Handle Notif Dropdown
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 2. FETCH NOTIFICATIONS (REAL-TIME) ---
  useEffect(() => {
    if (!user) return;

    // Query: Ambil notifikasi terbaru (Limit 20)
    // Idealnya filter by user_id atau role jika aplikasi multi-user kompleks
    const q = query(
      collection(db, "notifications"),
      orderBy("created_at", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
      
      // Hitung yang belum dibaca
      const unread = notifs.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [user]);

  // --- 3. ACTIONS ---
  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar sistem?")) {
      try {
        await signOut(auth);
      } catch (error) {
        alert("Gagal logout");
      }
    }
  };

  const handleMarkAsRead = async (notif) => {
    try {
      if (!notif.is_read) {
        const notifRef = doc(db, "notifications", notif.id);
        await updateDoc(notifRef, { is_read: true });
      }
      // Jika ada link, redirect
      if (notif.link) {
        setIsNotifOpen(false);
        router.push(notif.link);
      }
    } catch (e) {
      console.error("Gagal update notif", e);
    }
  };

  const handleMarkAllRead = async () => {
    // Batch update bisa digunakan di sini untuk performa lebih baik
    // Untuk simpelnya, kita map loop (hati-hati jika data banyak)
    const unread = notifications.filter(n => !n.is_read);
    unread.forEach(async (n) => {
       await updateDoc(doc(db, "notifications", n.id), { is_read: true });
    });
  };

  // Helper Icon berdasarkan tipe notifikasi
  const getNotifIcon = (type) => {
      switch(type) {
          case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500"/>;
          case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500"/>;
          case 'error': return <XCircle className="w-4 h-4 text-rose-500"/>;
          default: return <Info className="w-4 h-4 text-blue-500"/>;
      }
  }

  // Helper Time Ago Sederhana
  const timeAgo = (timestamp) => {
      if(!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const seconds = Math.floor((new Date() - date) / 1000);
      let interval = seconds / 31536000;
      if (interval > 1) return Math.floor(interval) + "y ago";
      interval = seconds / 2592000;
      if (interval > 1) return Math.floor(interval) + "mo ago";
      interval = seconds / 86400;
      if (interval > 1) return Math.floor(interval) + "d ago";
      interval = seconds / 3600;
      if (interval > 1) return Math.floor(interval) + "h ago";
      interval = seconds / 60;
      if (interval > 1) return Math.floor(interval) + "m ago";
      return "Just now";
  }

  if (!user || pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-40 w-full flex items-center h-14 md:h-16 px-4 md:px-6 justify-between shrink-0 transition-all duration-300 bg-surface border-b border-border"> 
      
      {/* --- LEFT AREA --- */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Mobile Logo */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-primary to-accent rounded flex items-center justify-center text-white shadow-sm">
             <span className="font-display font-bold text-sm">B</span>
          </div>
        </div>

        {/* Desktop Toggle */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          aria-label="Toggle Sidebar"
          className="hidden md:flex p-1.5 text-text-secondary hover:text-primary rounded-md hover:bg-gray-100 transition-colors border border-transparent hover:border-border"
        >
          {isSidebarCollapsed ? (
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          ) : (
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          )}
        </button>

        <div className="h-6 w-px bg-border hidden md:block mx-1"></div>

        {/* Title */}
        <div className="flex flex-col justify-center">
            <div className="hidden md:flex items-center text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">
                <span className="text-primary mr-2">App</span>
                <span>/ {pathname.split('/')[1] || 'home'}</span>
            </div>
            <h2 className="text-base md:text-lg font-display font-bold text-text-primary tracking-wide leading-none truncate max-w-[200px] md:max-w-none">
            {getTitle(pathname)}
            </h2>
        </div>
      </div>

      {/* --- RIGHT AREA --- */}
      <div className="flex items-center gap-2 md:gap-5">
        
        {/* Search Bar */}
        <div className="hidden md:flex items-center bg-surface border border-border rounded-lg px-3 py-1.5 w-64 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-inner">
          <svg className="w-4 h-4 text-text-secondary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" placeholder="Quick search..." className="bg-transparent text-xs outline-none w-full text-text-primary placeholder-text-secondary/50 font-mono" />
          <span className="text-[9px] text-text-secondary border border-border px-1 rounded bg-surface">⌘K</span>
        </div>
        
        {/* --- NOTIFICATION BELL (UPDATED) --- */}
        <div className="relative" ref={notifRef}>
            <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label="Notifications"
                className="relative p-2 text-text-secondary hover:text-primary transition-colors group hover:bg-gray-50 rounded-lg"
            >
               {unreadCount > 0 && (
                   <>
                    <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-ping"></span>
                    <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
                   </>
               )}
               <Bell className="w-5 h-5" />
            </button>

            {/* Notification Dropdown */}
            {isNotifOpen && (
                <div className="absolute right-0 top-full mt-3 w-80 md:w-96 bg-surface border border-border rounded-xl shadow-2xl animate-fade-in origin-top-right ring-1 ring-black/5 z-50 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-border bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-sm text-text-primary">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                                <Check className="w-3 h-3"/> Mark all read
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                                <p className="text-xs">Tidak ada notifikasi.</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div 
                                    key={notif.id}
                                    onClick={() => handleMarkAsRead(notif)}
                                    className={`p-4 border-b border-border last:border-0 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3 ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                                >
                                    <div className="mt-0.5 shrink-0">
                                        {getNotifIcon(notif.type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className={`text-xs ${!notif.is_read ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                                                {notif.title}
                                            </p>
                                            <span className="text-[9px] text-text-secondary whitespace-nowrap ml-2">
                                                {timeAgo(notif.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">
                                            {notif.message}
                                        </p>
                                    </div>
                                    {!notif.is_read && (
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0"></div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    
                    <div className="p-2 border-t border-border bg-gray-50 text-center">
                        <Link href="/notifications" className="text-[10px] font-bold text-text-secondary hover:text-primary">
                            View All History
                        </Link>
                    </div>
                </div>
            )}
        </div>

        <div className="h-6 w-px bg-border hidden md:block"></div>

        {/* USER PROFILE DROPDOWN */}
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 cursor-pointer group hover:bg-gray-100/50 p-1.5 rounded-lg transition-all focus:outline-none"
            >
               <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">{user?.email?.split('@')[0]}</p>
                  <p className="text-[9px] text-text-secondary uppercase tracking-wider">Admin</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent p-[1px] shadow-sm group-hover:shadow-lg transition-all">
                  <div className="w-full h-full rounded-lg bg-surface flex items-center justify-center">
                    <span className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
            </button>

            {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl py-1 animate-fade-in origin-top-right ring-1 ring-black/5 z-50">
                    <div className="px-4 py-2 border-b border-border mb-1 block sm:hidden">
                        <p className="text-xs text-text-primary font-bold">{user?.email}</p>
                    </div>
                    <Link href="/settings" className="block px-4 py-2 text-xs text-text-primary hover:bg-gray-100 transition-colors">
                        Settings
                    </Link>
                    <div className="border-t border-border my-1"></div>
                    <button 
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 transition-colors font-bold"
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </div>

      </div>
    </header>
  );
}