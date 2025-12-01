"use client";
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // Penting untuk properti 'fill: true'
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register hanya komponen yang dibutuhkan Line Chart
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function RevenueChart({ data }) {
  if (!data) return null;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#6B7280', // text-gray-500
          font: { size: 11 },
          usePointStyle: true,
          boxWidth: 6
        },
        position: 'top',
        align: 'end'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1F2937',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4
      }
    },
    scales: {
      y: {
        grid: { color: '#F3F4F6' },
        ticks: {
          color: '#9CA3AF',
          font: { size: 10 },
          callback: (value) => {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
            return value;
          }
        },
        border: { display: false }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9CA3AF', font: { size: 10 } },
        border: { display: false }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return <Line data={data} options={options} />;
}