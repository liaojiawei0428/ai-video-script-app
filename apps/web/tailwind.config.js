/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0F172A', secondary: '#1E293B', tertiary: '#334155' },
        text: { primary: '#F1F5F9', secondary: '#94A3B8', tertiary: '#64748B' },
        accent: { DEFAULT: '#3B82F6', hover: '#2563EB' },
        primary: '#6366F1',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        border: '#1E293B',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        gradient: { '0%,100%': { 'background-position': '0% 50%' }, '50%': { 'background-position': '100% 50%' } },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
};
