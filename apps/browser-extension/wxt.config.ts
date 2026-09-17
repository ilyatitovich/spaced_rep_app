import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import svgr from 'vite-plugin-svgr'
import { defineConfig } from 'wxt'

const extensionRoot = path.dirname(fileURLToPath(import.meta.url))
const apiOrigin = new URL(
  process.env.WXT_PUBLIC_API_URL ?? 'http://localhost:3000'
).origin
const appHost = new URL(
  process.env.WXT_PUBLIC_APP_URL ?? 'http://localhost:5173'
).hostname
const webauthnHostPermission =
  appHost === 'localhost' || appHost === '127.0.0.1'
    ? 'http://localhost/*'
    : `https://${appHost}/*`
const clientSource = path.resolve(extensionRoot, '../client/src')

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [
      svgr(),
      tailwindcss(),
      {
        name: 'turnstile-stub',
        enforce: 'pre',
        resolveId(id: string) {
          if (!/(^|\/)turnstile-widget(\.tsx)?$/.test(id)) return
          return path.join(extensionRoot, 'src/turnstile-stub.tsx')
        }
      }
    ]
  }),
  alias: {
    '@/assets': path.join(clientSource, 'assets'),
    '@/components': path.join(clientSource, 'components'),
    '@/contexts': path.join(extensionRoot, 'src/contexts'),
    '@/hooks': path.join(clientSource, 'hooks'),
    '@/lib': path.join(clientSource, 'lib'),
    '@/models': path.join(clientSource, 'models'),
    '@/store': path.join(clientSource, 'store'),
    '@/types': path.join(clientSource, 'types')
  },
  manifest: {
    name: 'SpacedRep Card Creator',
    description: 'Create flashcards from anything you select on the web.',
    version: '0.1.0',
    minimum_chrome_version: '122',
    permissions: [
      'activeTab',
      'alarms',
      'contextMenus',
      'identity',
      'scripting',
      'sidePanel',
      'storage',
      'unlimitedStorage'
    ],
    host_permissions: [`${apiOrigin}/*`, webauthnHostPermission],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Create a flashcard'
    }
  }
})
