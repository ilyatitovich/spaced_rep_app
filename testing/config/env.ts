import path from 'node:path'
import dotenv from 'dotenv'

const repoRoot = path.resolve(process.cwd())

let loaded = false

export function getRepoRoot(): string {
  return repoRoot
}

/** Load `.env.test` from the repo root and force NODE_ENV=test. Idempotent. */
export function loadTestEnv(): void {
  if (loaded) return

  dotenv.config({ path: path.join(repoRoot, '.env.test') })
  process.env.NODE_ENV = 'test'
  loaded = true
}

export type TestEnv = {
  nodeEnv: 'test'
  databaseUrl: string
  redisUrl: string
  corsOrigin: string
  jwtSecret: string
  otpPepper: string
  webauthnRpId: string
  webauthnOrigin: string
  playwrightBaseUrl: string
}

export function getTestEnv(): TestEnv {
  loadTestEnv()

  const databaseUrl = process.env.DATABASE_URL
  const redisUrl = process.env.REDIS_URL

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing. Copy .env.test.example to .env.test and create the test database.'
    )
  }
  if (!redisUrl) {
    throw new Error(
      'REDIS_URL is missing. Copy .env.test.example to .env.test.'
    )
  }

  return {
    nodeEnv: 'test',
    databaseUrl,
    redisUrl,
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    jwtSecret:
      process.env.JWT_SECRET ??
      'test-jwt-secret-at-least-32-characters-long',
    otpPepper:
      process.env.OTP_PEPPER ??
      'test-otp-pepper-at-least-32-chars-long',
    webauthnRpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    webauthnOrigin:
      process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:5173',
    playwrightBaseUrl:
      process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  }
}

/** Reset loader state — for tests that need to reload env. */
export function resetTestEnvLoader(): void {
  loaded = false
}
