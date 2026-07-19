import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../../shared/config/env.js'
import { UnauthorizedError } from '../../shared/lib/errors.js'

const encoder = new TextEncoder()
const jwtSecret = encoder.encode(env.JWT_SECRET)

export type AccessTokenPayload = {
  userId: string
  sessionId: string
}

export async function signAccessToken(payload: AccessTokenPayload) {
  return new SignJWT({
    sid: payload.sessionId,
    typ: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(jwtSecret)
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: ['HS256']
    })

    if (
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedError('Invalid access token')
    }

    return { userId: payload.sub, sessionId: payload.sid }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    throw new UnauthorizedError('Invalid or expired access token')
  }
}

export function createRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function accessTokenExpiresIn(): number {
  return env.ACCESS_TOKEN_TTL_SECONDS
}
