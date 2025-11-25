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
            // --- PALET WARNA LIGHT MODE MODERN ---
            'lumina-base': '#FFFFFF',               // Putih Murni (Hampir selalu background utama)
            'lumina-surface': '#F9FAFB',          // Surface (Card/Modal) - Sedikit lebih gelap dari base
            'lumina-border': '#E5E7EB',            // Border yang lembut
            'lumina-text': '#111827',               // Teks Utama - Hitam Kebiruan
            'lumina-muted': '#99a0adff',             // Teks Sekunder/Muted - Abu-abu sedang
            'lumina-highlight': '#F3F4F6',       // Hover Background yang sangat subtle
            
            // PERUBAHAN UTAMA: Melembutkan Gold (Menggunakan format heksa 6 digit yang konsisten)
            'lumina-gold': '#CFA24D',         // Aksen Gold yang lebih lembut (softened Gold)
            'lumina-gold-light': '#FCD34D',   // Aksen Gold versi terang (untuk gradient)
            // --- AKHIR PALET WARNA ---
         },
         boxShadow: {
            // PERUBAHAN 1: Melembutkan glow agar tidak terlalu tajam di light mode
            'gold-glow': '0 0 10px rgba(207, 162, 77, 0.2)', 
            // PERUBAHAN 2: Menghapus shadow glass gelap yang kontradiktif
            'glass': '0 4px 12px 0 rgba(0, 0, 0, 0.05)',          
         }
      },
   },
   plugins: [],
}