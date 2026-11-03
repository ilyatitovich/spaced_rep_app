import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'
import { envSchema } from './env-schema.js'

/**
 * A deploy that follows only the docs must pass env validation, so the
 * documented env, the compose file and the image have to agree with `env.ts`.
 */

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../..'
)

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), 'utf8')
}

const requiredKeys = Object.entries(envSchema.shape)
  .filter(([, field]) => !field.safeParse(undefined).success)
  .map(([key]) => key)

describe('required env is documented', () => {
  it('finds the required variables', () => {
    expect(requiredKeys).toContain('DATABASE_URL')
    expect(requiredKeys).toContain('VAPID_PUBLIC_KEY')
  })

  it.each(['.env.example', 'apps/server/src/.env.example'])(
    '%s lists every required variable',
    file => {
      const present = Object.keys(dotenv.parse(read(file)))
      expect(requiredKeys.filter(key => !present.includes(key))).toEqual([])
    }
  )

  it('docs/deploy.md mentions every required variable', () => {
    const doc = read('docs/deploy.md')
    expect(requiredKeys.filter(key => !doc.includes(key))).toEqual([])
  })
})

describe('production compose is safe by default', () => {
  it('does not grant free Pro unless BETA_OPEN_PRO is set explicitly', () => {
    expect(read('docker-compose.prod.yml')).toContain(
      'BETA_OPEN_PRO: ${BETA_OPEN_PRO:-false}'
    )
  })
})

describe('server image toolchain', () => {
  it('uses the pnpm version pinned in package.json', () => {
    const pinned = /^pnpm@([^+]+)/.exec(
      (JSON.parse(read('package.json')) as { packageManager: string })
        .packageManager
    )?.[1]
    const inImage = /corepack prepare pnpm@(\S+)/.exec(
      read('apps/server/Dockerfile')
    )?.[1]

    expect(inImage).toBe(pinned)
  })
})
