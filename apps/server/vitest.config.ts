import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'server',
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts']
  }
})
