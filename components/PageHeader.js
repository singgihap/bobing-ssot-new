// components/PageHeader.js
import React from 'react';

const PageHeader = ({ title, subtitle, actions }) => {
  return (
    <div className="flex justify-between items-start mb-6 pt-4 md:pt-8">
      {/* Kiri: Judul dan Subjudul */}
      <div className="flex flex-col">
        {/* Judul: Mengganti text-lumina-text menjadi text-text-primary */}
        <h1 className="text-2xl md:text-3xl font-display font-bold text-text-primary leading-tight">
          {title}
        </h1>
        {/* Subjudul: Mengganti text-lumina-muted menjadi text-text-secondary */}
        {subtitle && (
          <p className="text-sm text-text-secondary mt-1.5 tracking-wide">
            {subtitle}
          </p>
        )}
      </div>

      {/* Kanan: Tombol Aksi */}
      <div className="flex items-center gap-3 mt-1">
        {actions}
      </div>
    </div>
  );
};

export default PageHeader;