import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the site from /homebase/; the desktop app (Tauri) and dev server use /
  base: process.env.GITHUB_PAGES ? '/homebase/' : '/',
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
})
