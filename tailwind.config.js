/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#0c0a09',
          panel: '#1c1917',
          card: '#292524',
          border: '#44403c',
          amber: '#f59e0b',
          green: '#10b981',
          cyan: '#0ea5e9',
          red: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
};
