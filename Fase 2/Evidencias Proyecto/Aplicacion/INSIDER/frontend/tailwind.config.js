/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        duoc: {
          blue: '#002855',
          'blue-700': '#003a78',
          'blue-50': '#e8eef6',
          yellow: '#FFC72C',
          'yellow-600': '#e6ac0e',
          gray: '#f4f5f7',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 3px rgba(0,40,85,.08), 0 4px 16px rgba(0,40,85,.06)' },
    },
  },
  plugins: [],
}
