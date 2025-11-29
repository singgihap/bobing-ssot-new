/** @type {import('tailwindcss').Config} */
module.exports = {
   content: [
     "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
   ],
   theme: {
      extend: {
         fontFamily: {
            sans: ['Inter', 'sans-serif'],
            display: ['Outfit', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
         },
         colors: {
            // --- PALET WARNA PROFESIONAL ERP BARU ---
            // Nomenklatur berdasarkan peran: primary, accent, secondary, dan utility lainnya.

            // Warna Fungsional Utama (Primary, Accent, Secondary)
            'primary': '#2563EB',             // Biru Vibrant: Kepercayaan, Fokus.
            'accent': '#844fc1',              // Ungu Premium: Inovatif, Modern.
            'secondary': '#34E9E1',           // Aqua Water: Segar, Info Sekunder.
            
            // Warna Netral & Latar Belakang
            'background': '#f6f6fa',          // Putih Kebiruan: Latar Belakang Utama.
            'surface': '#FFFFFF',             // Putih Murni: Untuk Card/Modal.
            'border': '#E5E7EB',              // Border: Abu-abu netral yang lembut.
            
            // Warna Teks
            'text-primary': '#181C24',        // Slate/Navy Gelap: Teks Utama (Kontras Tinggi).
            'text-secondary': '#6B7280',      // Abu-abu Sedang: Untuk Teks Sekunder/Muted.

            // Aksen Opsional
            'accent-gold': '#FFC857',         // Emas Desaturated: Aksi Khusus/Premium.

            // Palet 'lumina-' lama telah dihapus untuk mengadopsi skema baru.
         },
         boxShadow: {
            // PERUBAHAN 1: Mengubah glow ke Ungu Premium (accent) untuk konsistensi.
            'accent-glow': '0 0 10px rgba(132, 79, 193, 0.2)', // Berbasis Ungu (#844fc1)
            // PERUBAHAN 2: Pertahankan shadow glass netral.
            'glass': '0 4px 12px 0 rgba(0, 0, 0, 0.05)',          
         },
         // --- ANIMASI SHIMMER DITAMBAHKAN DI SINI ---
         keyframes: {
            shimmer: {
               '100%': {
                  transform: 'translateX(100%)',
               },
            },
         },
         animation: {
            shimmer: 'shimmer 1.5s infinite',
         },
      },
   },
   plugins: [],
}