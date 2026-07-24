import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // 8080 is often taken; the backend dev default here is 8790.
    proxy: {
      '/api': `http://localhost:${process.env.BACKEND_PORT ?? '8790'}`,
    },
  },
})
