/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Tu pourras ajouter tes couleurs personnalisées ici plus tard
      colors: {
        purpleNicou: '#a855f7',
      },
    },
  },
  plugins: [],
}