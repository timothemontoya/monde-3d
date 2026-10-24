import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH : sous-dossier du site en ligne (ex : /ile/ sur GitHub Pages). Vide en local.
export default defineConfig({
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : '/',
  plugins: [react()],
})
