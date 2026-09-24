import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { VitePWAOptions } from 'vite-plugin-pwa'
import { VitePWA } from 'vite-plugin-pwa'
import svgr from 'vite-plugin-svgr'

const isDev = process.env.NODE_ENV === 'development'
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  base: '/',
  includeAssets: [
    '/favicon.ico',
    '/apple-touch-icon.png',
    'assets/fonts/*.woff2'
  ],
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,woff2,md,png,svg,ico}']
  },
  manifest: {
    id: '/',
    name: 'Spaced Repetition',
    short_name: 'Spaced Repetition',
    description:
      'An app for memorizing information using spaced repetition techniques',
    start_url: '/?utm_source=pwa',
    scope: '/',
    theme_color: '#f5f5f5',
    background_color: '#f5f5f5',
    display: 'standalone',
    related_applications: [
      {
        platform: 'webapp',
        url: '/manifest.webmanifest'
      }
    ],
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
    enabled: isDev,
    type: 'module'
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden'
  },
  plugins: [
    react(),
    svgr(),
    tailwindcss(),
    VitePWA(pwaOptions),
    // Uploads only when SENTRY_AUTH_TOKEN is set (CI / local release builds).
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG || 'spacedrep',
            project: process.env.SENTRY_PROJECT || 'javascript-react',
            authToken: sentryAuthToken,
            sourcemaps: { filesToDeleteAfterUpload: ['**/*.map'] }
          })
        ]
      : [])
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@spaced-rep/sync-protocol': resolve(
        import.meta.dirname,
        '../../packages/sync-protocol/src/index.ts'
      )
    }
  },
  // Anki import worker pulls JSZip/sql.js; IIFE can't code-split those.
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    include: ['workbox-window']
  }
})
