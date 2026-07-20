import { execSync } from 'node:child_process'
import path from 'node:path'
import { getRepoRoot, loadTestEnv } from '../config/env.js'

export function migrateTestDatabase(): void {
  loadTestEnv()
  const serverDir = path.join(getRepoRoot(), 'apps/server')

  execSync('pnpm exec prisma migrate deploy', {
    cwd: serverDir,
    env: process.env,
    stdio: 'inherit'
  })
}
