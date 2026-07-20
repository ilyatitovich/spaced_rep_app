import { mergeConfig, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: 'client',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.ts'],
      include: ['src/**/*.test.{ts,tsx}']
    }
  })
)
