// components/Skeleton.js
import React from 'react';

// Efek Shimmer Dasar: Mengganti bg-lumina-highlight menjadi bg-gray-100
const Shimmer = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-100 rounded-md ${className}`}></div>
);

// Komponen Skeleton
const Skeleton = ({ type }) => {
    switch (type) {
        case 'tabs':
            return (
                // Mengganti border-lumina-border/50 menjadi border-border/50
                <div className="flex space-x-4 mb-8 border-b border-border/50">
                    <Shimmer className="w-20 h-8" />
                    <Shimmer className="w-24 h-8" />
                    <Shimmer className="w-16 h-8" />
                    <Shimmer className="w-28 h-8" />
                </div>
            );
        case 'card':
            return (
                // Mengganti bg-lumina-surface dan border-lumina-border
                <div className="p-4 bg-surface border border-border rounded-xl shadow-md">
                    <Shimmer className="w-1/2 h-5 mb-3" />
                    <Shimmer className="w-full h-32" />
                </div>
            );
        case 'list':
            return (
                <div className="space-y-4">
                    <Shimmer className="w-full h-10" />
                    <Shimmer className="w-full h-10" />
                    <Shimmer className="w-3/4 h-10" />
                </div>
            );
        default:
            return <Shimmer className="w-full h-8" />;
    }
};

export default Skeleton;