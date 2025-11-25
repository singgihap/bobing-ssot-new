// components/PageHeader.js
"use client";

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-lumina-border/50 pb-6">
      {/* Bagian Kiri: Judul & Subjudul */}
      <div className="w-full md:w-auto">
        {/* PERBAIKAN: Ganti text-white menjadi text-lumina-text */}
        <h2 className="text-2xl md:text-3xl font-display font-bold text-lumina-text tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs md:text-sm text-lumina-muted mt-1 font-light leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Bagian Kanan: Tombol Aksi / Filter */}
      {children && (
        <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}