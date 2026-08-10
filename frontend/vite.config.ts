import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The app prompts before reloading, so we control activation ourselves.
      registerType: 'prompt',
      injectRegister: null,
      // manifest.webmanifest is authored by hand in public/ and linked from
      // index.html; the plugin only needs to precache it.
      manifest: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'manifest.webmanifest'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Serve the SPA shell for client-side routes while offline. /api is
        // excluded so requests fall through to the network and surface a real
        // error instead of being answered with index.html.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Health data behind auth is deliberately NOT runtime-cached: Cache API
        // entries are not cleared on logout and would leak one account's logs to
        // the next user of the device. Offline reads come from the react-query
        // cache in IndexedDB (see src/lib/persist.ts), which logout wipes.
        runtimeCaching: [],
      },
      devOptions: {
        // Lets the offline flow be exercised with `vite dev`.
        enabled: true,
        type: 'module',
        navigateFallback: '/index.html',
      },
    }),
  ],
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
