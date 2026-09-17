import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'

const apiOrigin = new URL(
  process.env.WXT_PUBLIC_API_URL ?? 'http://localhost:3000'
).origin
const clientSource = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../client/src'
)

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()]
  }),
  alias: {
    '@/assets': path.join(clientSource, 'assets'),
    '@/components': path.join(clientSource, 'components'),
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
    minimum_chrome_version: '116',
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
    host_permissions: [`${apiOrigin}/*`],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Create a flashcard'
    }
  }
})
