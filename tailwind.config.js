/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        anu: {
          gold: '#BE830E',
          'gold-light': '#D4A84A',
          'gold-dark': '#8A5F0A',
          blue: '#002F5F',
          'blue-light': '#1A4A7A',
          'blue-dark': '#001F3F',
        }
      }
    },
  },
  plugins: [],
}
