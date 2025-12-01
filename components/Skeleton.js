import React from 'react';

// Efek Shimmer Modern
const Shimmer = ({ className = '' }) => (
    <div className={`relative overflow-hidden bg-gray-100/80 rounded-lg ${className}`}>
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
    </div>
);

// UPDATE: Tambahkan prop 'className'
const Skeleton = ({ type, className = "" }) => {
    switch (type) {
        case 'tabs':
            return (
                <div className={`flex space-x-6 mb-8 border-b border-border/50 pb-1 ${className}`}>
                    <Shimmer className="w-24 h-8 rounded-lg" />
                    <Shimmer className="w-28 h-8 rounded-lg" />
                    <Shimmer className="w-20 h-8 rounded-lg" />
                </div>
            );
        case 'card':
            return (
                <div className={`p-6 bg-white border border-border rounded-2xl shadow-sm ${className}`}>
                    <div className="flex justify-between items-start mb-4">
                        <Shimmer className="w-1/3 h-4" />
                        <Shimmer className="w-8 h-8 rounded-lg" />
                    </div>
                    <Shimmer className="w-3/4 h-10 mb-2" />
                    <Shimmer className="w-1/2 h-4" />
                </div>
            );
        default:
            // UPDATE: Gabungkan className default dengan className dari props
            // Kita hapus 'w-full h-full' default agar bisa di-override jika perlu, 
            // tapi kita berikan fallback jika className kosong.
            return <Shimmer className={`min-h-[2rem] w-full ${className}`} />;
    }
};

export default Skeleton;