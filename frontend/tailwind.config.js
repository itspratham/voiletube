/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vt: {
          bg: 'rgb(var(--vt-bg) / <alpha-value>)',
          surface: 'rgb(var(--vt-surface) / <alpha-value>)',
          'surface-strong': 'rgb(var(--vt-surface-strong) / <alpha-value>)',
          'surface-soft': 'rgb(var(--vt-surface-soft) / <alpha-value>)',
          border: 'rgb(var(--vt-border) / <alpha-value>)',
          text: 'rgb(var(--vt-text) / <alpha-value>)',
          muted: 'rgb(var(--vt-muted) / <alpha-value>)',
          accent: 'rgb(var(--vt-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--vt-accent-hover) / <alpha-value>)',
          chip: 'rgb(var(--vt-chip) / <alpha-value>)',
          'chip-hover': 'rgb(var(--vt-chip-hover) / <alpha-value>)',
          gold: 'rgb(var(--vt-gold) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(10px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
