/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        'vb-orange': '#FF6B35',
        'vb-orange-light': '#FFF3ED',
        // Naranja para texto y fondos con texto blanco (contraste AA sobre blanco).
        'vb-orange-ink': '#C2410C',
        'vb-blue': '#1A237E',
        'vb-yellow': '#FFD23F',
        'vb-white': '#FFFFFF',
        'vb-gray': '#2D3436',
        'vb-light': '#F8F9FA',
        'vb-green': '#00C853',
        'vb-red': '#FF3D00',
        ink: '#101820',
        court: '#2d7d6f',
        sand: '#f5b85f',
        line: '#f4f7f5',
      },
      boxShadow: {
        soft: '0 18px 60px rgba(16, 24, 32, 0.12)',
        glow: '0 0 40px rgba(45, 125, 111, 0.15)',
        card: '0 4px 24px rgba(26, 35, 126, 0.08)',
        'card-hover': '0 12px 40px rgba(26, 35, 126, 0.15)',
      },
      screens: {
        xs: '480px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'progress': 'progress 1s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        progress: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-width, 0%)' },
        },
      },
    },
  },
  plugins: [],
};
