/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Segoe UI', 'sans-serif'], mono: ['JetBrains Mono', 'Consolas', 'monospace'] },
      borderRadius: { xl: '6px', '2xl': '8px', '3xl': '8px' },
      letterSpacing: { tight: '0', wider: '0', widest: '0' },
      colors: {
        clinical: {
          dark: '#0B1120',
          card: '#151F32',
          border: '#1E293B',
          accent: '#0EA5E9',
          success: '#10B981',
          warning: '#F59E0B',
          critical: '#EF4444',
          muted: '#94A3B8',
        }
      }
    },
  },
  plugins: [],
}
