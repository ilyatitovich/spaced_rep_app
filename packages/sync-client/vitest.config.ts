import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'sync-client',
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts']
  }
})
