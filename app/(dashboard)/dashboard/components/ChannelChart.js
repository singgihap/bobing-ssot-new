"use client";
import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register hanya komponen yang dibutuhkan Doughnut
ChartJS.register(ArcElement, Tooltip, Legend);

export default function ChannelChart({ data }) {
  if (!data) return null;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%', // Membuat lubang tengah (Donut style)
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#6B7280',
          font: { size: 10 },
          usePointStyle: true,
          padding: 20,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1F2937',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1
      }
    }
  };

  return <Doughnut data={data} options={options} />;
}