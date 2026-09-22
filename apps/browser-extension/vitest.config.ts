import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const extensionRoot = path.dirname(fileURLToPath(import.meta.url))
const clientSource = path.resolve(extensionRoot, '../client/src')

export default defineConfig({
  resolve: {
    alias: {
      '@ext': path.join(extensionRoot, 'src'),
      '@/lib': path.join(clientSource, 'lib'),
      '@/types': path.join(clientSource, 'types')
    }
  },
  test: {
    name: 'browser-extension',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts']
  }
})
