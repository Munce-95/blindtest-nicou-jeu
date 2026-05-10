import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // On ajoute cette ligne pour que les liens vers les fichiers soient relatifs au nom de ton repo
  base: '/blindtest-nicou-jeu/', 
})
