/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        steel: {
          950: '#090d13',
          900: '#0f1724',
          800: '#1b2537',
          700: '#2b3952',
          600: '#425575',
          500: '#647c9f',
          400: '#91a5c4',
          300: '#c2d1e5',
          100: '#eaf0f8',
        },
        defect: {
          dent: '#f59e0b',
          hole: '#ef4444',
          scratch: '#06b6d4',
        }
      }
    },
  },
  plugins: [],
}
