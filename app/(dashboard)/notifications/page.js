"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, writeBatch, doc, where } from 'firebase/firestore';
import PageHeader from '@/components/PageHeader';
import { CheckCheck, Trash2, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationItem from './components/NotificationItem';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'unread'

    useEffect(() => {
        fetchNotifications();
    }, [filter]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            let q;
            if (filter === 'unread') {
                q = query(
                    collection(db, "notifications"), 
                    where("is_read", "==", false),
                    orderBy("created_at", "desc"), 
                    limit(50)
                );
            } else {
                q = query(
                    collection(db, "notifications"), 
                    orderBy("created_at", "desc"), 
                    limit(50)
                );
            }

            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setNotifications(data);
        } catch (e) {
            console.error(e);
            toast.error("Gagal memuat notifikasi");
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            const batch = writeBatch(db);
            const ref = doc(db, "notifications", id);
            batch.update(ref, { is_read: true });
            await batch.commit();
            
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (e) {
            console.error(e);
        }
    };

    const markAllRead = async () => {
        const unread = notifications.filter(n => !n.is_read);
        if (unread.length === 0) return;

        const tId = toast.loading("Mengupdate...");
        try {
            const batch = writeBatch(db);
            unread.forEach(n => {
                const ref = doc(db, "notifications", n.id);
                batch.update(ref, { is_read: true });
            });
            await batch.commit();
            
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            toast.success("Semua ditandai sudah dibaca", { id: tId });
        } catch (e) {
            toast.error("Gagal update", { id: tId });
        }
    };

    const clearAll = async () => {
        if(!confirm("Hapus semua notifikasi di halaman ini?")) return;
        const tId = toast.loading("Menghapus...");
        try {
            const batch = writeBatch(db);
            notifications.forEach(n => {
                const ref = doc(db, "notifications", n.id);
                batch.delete(ref);
            });
            await batch.commit();
            setNotifications([]);
            toast.success("Notifikasi dibersihkan", { id: tId });
        } catch (e) {
            toast.error("Gagal menghapus", { id: tId });
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 fade-in pb-20 text-text-primary">
            <PageHeader 
                title="Pusat Notifikasi" 
                subtitle="Riwayat aktivitas sistem, peringatan stok, dan update status."
                actions={
                    <div className="flex gap-2">
                        <button onClick={markAllRead} className="btn-ghost-dark text-xs flex items-center gap-2">
                            <CheckCheck className="w-4 h-4"/> Tandai Semua Dibaca
                        </button>
                        <button onClick={clearAll} className="btn-ghost-dark text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200 flex items-center gap-2">
                            <Trash2 className="w-4 h-4"/> Bersihkan
                        </button>
                    </div>
                }
            />

            {/* Filter Tabs */}
            <div className="flex gap-4 border-b border-border mb-4">
                <button 
                    onClick={() => setFilter('all')} 
                    className={`pb-2 text-sm font-bold px-2 transition-colors ${filter==='all' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}
                >
                    Semua
                </button>
                <button 
                    onClick={() => setFilter('unread')} 
                    className={`pb-2 text-sm font-bold px-2 transition-colors ${filter==='unread' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}
                >
                    Belum Dibaca
                </button>
            </div>

            {/* List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="py-20 text-center text-text-secondary animate-pulse">Memuat notifikasi...</div>
                ) : notifications.length === 0 ? (
                    <div className="py-20 text-center text-text-secondary flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-6 h-6 text-gray-300" />
                        </div>
                        <p>Tidak ada notifikasi {filter === 'unread' ? 'baru' : ''}.</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <NotificationItem key={notif.id} notif={notif} onMarkRead={markAsRead} />
                    ))
                )}
            </div>
        </div>
    );
}