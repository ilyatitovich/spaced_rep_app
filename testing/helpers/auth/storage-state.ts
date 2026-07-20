import fs from 'node:fs'
import path from 'node:path'
import type { Browser, BrowserContext } from '@playwright/test'
import { getRepoRoot } from '../../config/env.js'
import type { AuthTokens } from './session.js'
import { createSessionForUser } from './session.js'

const AUTH_DIR = path.join(getRepoRoot(), 'testing/.auth')
const AUTH_SESSION_KEY = 'auth.session'

export type StorageAuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: { id: string; email: string }
}

/** Build Playwright storageState that seeds the client's `auth.session` localStorage. */
export function createStorageState(
  tokens: AuthTokens,
  origin = 'http://localhost:5173'
) {
  const session: StorageAuthSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    user: tokens.user
  }

  return {
    cookies: [] as never[],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: AUTH_SESSION_KEY,
            value: JSON.stringify(session)
          }
        ]
      }
    ]
  }
}

export function writeStorageStateFile(
  tokens: AuthTokens,
  fileName = 'user.json',
  origin = 'http://localhost:5173'
): string {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const filePath = path.join(AUTH_DIR, fileName)
  fs.writeFileSync(
    filePath,
    JSON.stringify(createStorageState(tokens, origin), null, 2)
  )
  return filePath
}

/** Open a browser context already authenticated via API-created session tokens. */
export async function authenticatedContext(
  browser: Browser,
  email?: string
): Promise<{ context: BrowserContext; tokens: AuthTokens }> {
  const tokens = await createSessionForUser({ email })
  const context = await browser.newContext({
    storageState: createStorageState(tokens)
  })
  return { context, tokens }
}
