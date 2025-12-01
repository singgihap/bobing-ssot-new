// lib/notificationService.js
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const createNotification = async ({ title, message, type = 'info', link = '' }) => {
  try {
    await addDoc(collection(db, "notifications"), {
      title,
      message,
      type, // 'success', 'warning', 'error', 'info'
      link,
      is_read: false,
      created_at: serverTimestamp()
    });
  } catch (error) {
    console.error("Gagal membuat notifikasi:", error);
  }
};