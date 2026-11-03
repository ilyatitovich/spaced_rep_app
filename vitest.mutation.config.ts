import { defineConfig } from 'vitest/config'
import rootConfig from './vitest.config.ts'

const projects = rootConfig.test?.projects?.filter(
  project => project !== 'apps/server/vitest.integration.config.ts'
)

// Integration tests need Postgres and Redis, so they stay on `pnpm test`.
export default defineConfig({
  test: {
    projects
  }
})
