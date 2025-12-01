"use client";
import React from 'react';
import { formatDistanceToNow } from 'date-fns'; // Pastikan date-fns terinstall, atau pakai helper custom
import { id } from 'date-fns/locale';
import { CheckCircle, AlertTriangle, Info, XCircle, Clock } from 'lucide-react';

export default function NotificationItem({ notif, onMarkRead }) {
    const getIcon = (type) => {
        switch(type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500"/>;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500"/>;
            case 'error': return <XCircle className="w-5 h-5 text-rose-500"/>;
            default: return <Info className="w-5 h-5 text-blue-500"/>;
        }
    };

    const getBgColor = (type) => {
        switch(type) {
            case 'success': return 'bg-emerald-50 border-emerald-100';
            case 'warning': return 'bg-amber-50 border-amber-100';
            case 'error': return 'bg-rose-50 border-rose-100';
            default: return 'bg-white border-border';
        }
    };

    // Helper Time Ago manual jika tidak ingin install date-fns
    const timeAgo = (timestamp) => {
        if(!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((new Date() - date) / 1000);
        
        if(diff < 60) return 'Baru saja';
        if(diff < 3600) return `${Math.floor(diff/60)} menit lalu`;
        if(diff < 86400) return `${Math.floor(diff/3600)} jam lalu`;
        return `${Math.floor(diff/86400)} hari lalu`;
    };

    return (
        <div 
            className={`p-4 rounded-xl border mb-3 transition-all hover:shadow-sm ${!notif.is_read ? 'border-l-4 border-l-primary bg-white' : 'bg-gray-50 border-transparent opacity-80'}`}
        >
            <div className="flex gap-4">
                <div className={`p-2 rounded-full h-fit ${getBgColor(notif.type)}`}>
                    {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <h4 className={`text-sm ${!notif.is_read ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                            {notif.title}
                        </h4>
                        <span className="text-[10px] text-text-secondary flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3"/> {timeAgo(notif.created_at)}
                        </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                        {notif.message}
                    </p>
                    
                    <div className="flex gap-3 mt-3">
                        {notif.link && (
                            <a href={notif.link} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                                Lihat Detail &rarr;
                            </a>
                        )}
                        {!notif.is_read && (
                            <button onClick={() => onMarkRead(notif.id)} className="text-[10px] font-bold text-text-secondary hover:text-emerald-600">
                                Tandai Dibaca
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}