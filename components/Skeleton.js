// components/Skeleton.js
import React from 'react';

// Efek Shimmer Modern (Gradient Flow)
const Shimmer = ({ className = '' }) => (
    <div className={`relative overflow-hidden bg-gray-100/80 rounded-lg ${className}`}>
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
    </div>
);

const Skeleton = ({ type }) => {
    switch (type) {
        case 'tabs':
            return (
                <div className="flex space-x-6 mb-8 border-b border-border/50 pb-1">
                    <Shimmer className="w-24 h-8 rounded-lg" />
                    <Shimmer className="w-28 h-8 rounded-lg" />
                    <Shimmer className="w-20 h-8 rounded-lg" />
                </div>
            );
        case 'card':
            return (
                <div className="p-6 bg-white border border-border rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <Shimmer className="w-1/3 h-4" />
                        <Shimmer className="w-8 h-8 rounded-lg" />
                    </div>
                    <Shimmer className="w-3/4 h-10 mb-2" />
                    <Shimmer className="w-1/2 h-4" />
                </div>
            );
        case 'table':
            return (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex gap-4 items-center">
                            <Shimmer className="w-12 h-12 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Shimmer className="w-full h-4" />
                                <Shimmer className="w-2/3 h-3" />
                            </div>
                        </div>
                    ))}
                </div>
            );
        default:
            return <Shimmer className="w-full h-full min-h-[2rem]" />;
    }
};

export default Skeleton;