import crypto from 'node:crypto'
import { AuthMethod } from '../../generated/prisma/enums.js'
import { env } from '../../shared/config/env.js'
import { BadRequestError, UnauthorizedError } from '../../shared/lib/errors.js'
import { getRedis } from '../../shared/lib/redis.js'
import { createSessionWithTokens } from './session.service.js'

const PREFIX = 'auth:extension:'
const TTL_SECONDS = 120

type Grant = {
  userId: string
  redirectUri: string
  state: string
  codeChallenge: string
}

function validateRedirectUri(redirectUri: string): void {
  if (!env.EXTENSION_REDIRECT_URIS.includes(redirectUri)) {
    throw new BadRequestError('Invalid extension redirect URI')
  }
}

function challenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export async function createExtensionGrant(input: Grant): Promise<{
  code: string
  state: string
}> {
  validateRedirectUri(input.redirectUri)
  const code = crypto.randomBytes(32).toString('base64url')
  const redis = getRedis()
  if (!redis.isOpen) await redis.connect()
  await redis.set(`${PREFIX}${code}`, JSON.stringify(input), {
    EX: TTL_SECONDS,
    NX: true
  })
  return { code, state: input.state }
}

export async function exchangeExtensionGrant(input: {
  code: string
  codeVerifier: string
  redirectUri: string
  ipAddress?: string | null
  userAgent?: string | null
}) {
  validateRedirectUri(input.redirectUri)
  const redis = getRedis()
  if (!redis.isOpen) await redis.connect()
  const raw = await redis.getDel(`${PREFIX}${input.code}`)
  if (!raw) throw new UnauthorizedError('Invalid or expired extension code')
  const grant = JSON.parse(raw) as Grant
  if (
    grant.redirectUri !== input.redirectUri ||
    challenge(input.codeVerifier) !== grant.codeChallenge
  ) {
    throw new UnauthorizedError('Invalid extension code verifier')
  }
  return createSessionWithTokens({
    userId: grant.userId,
    authMethod: AuthMethod.OAUTH,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { client: 'browser-extension' }
  })
}
