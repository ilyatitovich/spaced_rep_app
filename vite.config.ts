import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import type { VitePWAOptions } from 'vite-plugin-pwa'
import { VitePWA } from 'vite-plugin-pwa'
import svgr from 'vite-plugin-svgr'

const isDev = process.env.NODE_ENV === 'development'

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  base: '/',
  includeAssets: ['/favicon.ico', '/apple-touch-icon.png'],
  manifest: {
    name: 'Spaced Repetition',
    short_name: 'Spaced Repetition',
    description:
      'An app for memorizing information using spaced repetition techniques',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      {
        src: '/pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png'
      },
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  },
  devOptions: {
    enabled: isDev
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svgr(), tailwindcss(), VitePWA(pwaOptions)],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
