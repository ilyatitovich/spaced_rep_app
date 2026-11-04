#!/usr/bin/env node
/**
 * Emit JS for production: sync-protocol → dist, then server → dist.
 * Rewrites the protocol package "exports" in this workspace copy so Node
 * resolves the compiled files (dev still uses tsx + source via the git
 * package.json until the next install overwrites this rewrite in Docker only).
 *
 * In Docker the rewrite is intentional and disposable. Locally prefer
 * `pnpm --filter spaced_rep_pwa_server build` inside an image build, or
 * restore package.json from git after experimenting.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(serverRoot, '../..')
const protocolRoot = join(repoRoot, 'packages/sync-protocol')

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], protocolRoot)

if (process.env.REWRITE_PROTOCOL_EXPORTS === '1') {
  const pkgPath = join(protocolRoot, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.exports = {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js'
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], serverRoot)

// Generated Prisma client is imported as ../../generated/prisma from
// dist/shared/lib — keep it next to the emitted tree.
mkdirSync(join(serverRoot, 'dist/generated'), { recursive: true })
cpSync(join(serverRoot, 'src/generated'), join(serverRoot, 'dist/generated'), {
  recursive: true
})

// Handlebars email templates and assets are read from disk at runtime.
cpSync(join(serverRoot, 'src/emails'), join(serverRoot, 'dist/emails'), {
  recursive: true,
  filter: src => !src.endsWith('.ts')
})

console.log('server build: dist/server.js ready')
