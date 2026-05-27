/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101820',
        court: '#2d7d6f',
        sand: '#f5b85f',
        line: '#f4f7f5',
      },
      boxShadow: {
        soft: '0 18px 60px rgba(16, 24, 32, 0.12)',
      },
    },
  },
  plugins: [],
};
