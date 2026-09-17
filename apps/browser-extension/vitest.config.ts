import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'browser-extension',
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts']
  }
})
