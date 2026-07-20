import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'server-integration',
    environment: 'node',
    globals: true,
    include: ['src/**/*.integration.test.ts'],
    globalSetup: '../../testing/setup/vitest.global-setup.ts',
    setupFiles: ['../../testing/setup/vitest.integration-setup.ts'],
    testTimeout: 30_000,
    pool: 'forks',
    fileParallelism: false
  }
})
