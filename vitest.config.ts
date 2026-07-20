import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/dist/**',
        '**/dev-dist/**',
        '**/coverage/**',
        '**/generated/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/setupTests.ts'
      ]
    },
    projects: [
      'apps/client/vitest.config.ts',
      'apps/server/vitest.config.ts',
      'packages/sync-protocol/vitest.config.ts',
      'testing/vitest.config.ts'
    ]
  }
})
