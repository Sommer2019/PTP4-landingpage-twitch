import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Für GitHub Pages mit Custom Domain (z.B. hd1920x1080.de): base: '/'
  // Für GitHub Pages OHNE Custom Domain: base: '/repo-name/'
  base: '/',
})
