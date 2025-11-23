/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          sm: "2rem",
          lg: "4rem",
          xl: "6rem",
          "2xl": "8rem",
        },
        screens: {
          sm: "600px",
          md: "728px",
          lg: "1024px",
          xl: "1280px",
          "2xl": "1536px",
          "3xl": "1800px" // tambah jika ingin super lebar
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Dark variant (Background/App Shell)
        dark: {
          950: '#020617',
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        // Aksen Brand/Primary (Gold - UX “luxury” + biru modern, feel SaaS)
        brand: {
          50:  "#f5f6fc",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#9CA3AF",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81"
        },
        gold: {
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          400_20: "rgba(251, 191, 36, 0.20)",
          500_20: "rgba(245, 158, 11, 0.20)",
        },
        // Light text
        light: {
          100: '#F1F5F9',
          300: '#CBD5E1',
          500: '#64748B',
        }
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(245, 158, 11, 0.3)",
        luxury: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
}
