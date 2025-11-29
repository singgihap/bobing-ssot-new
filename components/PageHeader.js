// components/PageHeader.js
"use client";
import React from 'react';
import { motion } from 'framer-motion';

const PageHeader = ({ title, subtitle, actions }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4"
    >
      {/* Kiri: Judul dan Subjudul */}
      <div className="flex flex-col">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-text-primary tracking-tight leading-snug">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-1 font-medium leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {/* Kanan: Tombol Aksi */}
      {actions && (
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {actions}
        </div>
      )}
    </motion.div>
  );
};

export default PageHeader;