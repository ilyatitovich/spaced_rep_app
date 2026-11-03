import { SignJWT, UnsecuredJWT } from 'jose'
import { describe, expect, it } from 'vitest'

import { getTestEnv } from '../../../../../testing/config/env.js'
import { getTestPrisma } from '../../../../../testing/db/prisma.js'
import { createSessionForUser } from '../../../../../testing/helpers/auth/session.js'
import { createTestAgent } from '../../../../../testing/helpers/http/supertest-app.js'

const PROTECTED_PATH = '/auth/me'

function secretBytes(secret: string = getTestEnv().jwtSecret) {
  return new TextEncoder().encode(secret)
}

interface ForgeOptions {
  sub: string
  sid?: string | undefined
  typ?: string | undefined
  alg?: 'HS256' | 'HS512'
  secret?: string
  /** Seconds relative to now. Defaults to +15 minutes. */
  expiresInSeconds?: number
}

async function forgeToken(opts: ForgeOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claims: Record<string, unknown> = {}
  if (opts.sid !== undefined) claims.sid = opts.sid
  if (opts.typ !== undefined) claims.typ = opts.typ

  return new SignJWT(claims)
    .setProtectedHeader({ alg: opts.alg ?? 'HS256' })
    .setSubject(opts.sub)
    .setIssuedAt(now - 3600)
    .setExpirationTime(now + (opts.expiresInSeconds ?? 900))
    .sign(secretBytes(opts.secret))
}

async function getProtected(authorization?: string) {
  const agent = await createTestAgent()
  const req = agent.get(PROTECTED_PATH)
  return authorization === undefined
    ? req
    : req.set('Authorization', authorization)
}

const UNAUTHORIZED = {
  status: 401,
  body: { error: { code: 'UNAUTHORIZED' } }
}

describe('requireAuth: malformed credentials', () => {
  it('rejects a missing Authorization header', async () => {
    expect(await getProtected()).toMatchObject(UNAUTHORIZED)
  })

  it('rejects "Bearer " with an empty token', async () => {
    expect(await getProtected('Bearer ')).toMatchObject(UNAUTHORIZED)
  })

  it('rejects "Bearer" with only whitespace after it', async () => {
    expect(await getProtected('Bearer    ')).toMatchObject(UNAUTHORIZED)
  })

  it('rejects a non-Bearer scheme', async () => {
    const { accessToken } = await createSessionForUser()
    expect(await getProtected(`Basic ${accessToken}`)).toMatchObject(
      UNAUTHORIZED
    )
  })

  it('rejects a token without a scheme', async () => {
    const { accessToken } = await createSessionForUser()
    expect(await getProtected(accessToken)).toMatchObject(UNAUTHORIZED)
  })

  it('rejects a lowercase "bearer" scheme', async () => {
    const { accessToken } = await createSessionForUser()
    expect(await getProtected(`bearer ${accessToken}`)).toMatchObject(
      UNAUTHORIZED
    )
  })

  it('rejects a malformed JWT', async () => {
    expect(await getProtected('Bearer not-a-jwt')).toMatchObject(UNAUTHORIZED)
    expect(await getProtected('Bearer a.b.c')).toMatchObject(UNAUTHORIZED)
  })

  it('rejects a JWT with a tampered signature', async () => {
    const { accessToken } = await createSessionForUser()
    const [header, payload, signature] = accessToken.split('.')
    // Change the first char: the last base64url char of a 32-byte signature
    // has unused padding bits, so altering it can decode to identical bytes.
    const tampered = `${signature?.startsWith('A') ? 'B' : 'A'}${signature?.slice(1)}`
    expect(
      await getProtected(`Bearer ${header}.${payload}.${tampered}`)
    ).toMatchObject(UNAUTHORIZED)
  })
})

describe('requireAuth: invalid JWT claims', () => {
  it('rejects an expired JWT', async () => {
    const { user } = await createSessionForUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: user.id }
    })

    const expired = await forgeToken({
      sub: user.id,
      sid: session.id,
      typ: 'access',
      expiresInSeconds: -60
    })

    expect(await getProtected(`Bearer ${expired}`)).toMatchObject(UNAUTHORIZED)
  })

  it('rejects a JWT signed with the wrong secret', async () => {
    const { user } = await createSessionForUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: user.id }
    })

    const forged = await forgeToken({
      sub: user.id,
      sid: session.id,
      typ: 'access',
      secret: 'a-different-secret-that-is-also-32-chars-long'
    })

    expect(await getProtected(`Bearer ${forged}`)).toMatchObject(UNAUTHORIZED)
  })

  it('rejects an unsigned JWT (alg: none)', async () => {
    const { user } = await createSessionForUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: user.id }
    })

    const unsigned = new UnsecuredJWT({ sid: session.id, typ: 'access' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('15m')
      .encode()

    expect(await getProtected(`Bearer ${unsigned}`)).toMatchObject(UNAUTHORIZED)
  })

  it('rejects a JWT signed with an algorithm other than HS256', async () => {
    const { user } = await createSessionForUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: user.id }
    })

    const hs512 = await forgeToken({
      sub: user.id,
      sid: session.id,
      typ: 'access',
      alg: 'HS512'
    })

    expect(await getProtected(`Bearer ${hs512}`)).toMatchObject(UNAUTHORIZED)
  })

  it('rejects a JWT with the wrong typ claim', async () => {
    const { user } = await createSessionForUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: user.id }
    })

    const refreshTyped = await forgeToken({
      sub: user.id,
      sid: session.id,
      typ: 'refresh'
    })
    expect(await getProtected(`Bearer ${refreshTyped}`)).toMatchObject(
      UNAUTHORIZED
    )

    const noTyp = await forgeToken({ sub: user.id, sid: session.id })
    expect(await getProtected(`Bearer ${noTyp}`)).toMatchObject(UNAUTHORIZED)
  })

  it('rejects a JWT without a sid claim', async () => {
    const { user } = await createSessionForUser()

    const noSid = await forgeToken({ sub: user.id, typ: 'access' })

    expect(await getProtected(`Bearer ${noSid}`)).toMatchObject(UNAUTHORIZED)
  })

  it('accepts a correctly forged JWT for a live session (control)', async () => {
    const { user } = await createSessionForUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: user.id }
    })

    const valid = await forgeToken({
      sub: user.id,
      sid: session.id,
      typ: 'access'
    })

    const res = await getProtected(`Bearer ${valid}`)
    expect(res.status).toBe(200)
  })
})

describe('requireAuth: session and user state', () => {
  it('rejects a token whose session was revoked', async () => {
    const { user, accessToken } = await createSessionForUser()
    await getTestPrisma().session.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() }
    })

    expect(await getProtected(`Bearer ${accessToken}`)).toMatchObject(
      UNAUTHORIZED
    )
  })

  it('rejects a token whose session has expired', async () => {
    const { user, accessToken } = await createSessionForUser()
    await getTestPrisma().session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    expect(await getProtected(`Bearer ${accessToken}`)).toMatchObject(
      UNAUTHORIZED
    )
  })

  it('rejects a token whose sid belongs to a different user', async () => {
    const owner = await createSessionForUser()
    const other = await createSessionForUser()
    const ownerSession = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: owner.user.id }
    })

    const mismatched = await forgeToken({
      sub: other.user.id,
      sid: ownerSession.id,
      typ: 'access'
    })

    expect(await getProtected(`Bearer ${mismatched}`)).toMatchObject(
      UNAUTHORIZED
    )
  })

  it('rejects a token for a session id that does not exist', async () => {
    const { user } = await createSessionForUser()

    const unknownSid = await forgeToken({
      sub: user.id,
      sid: '00000000-0000-4000-8000-000000000000',
      typ: 'access'
    })

    expect(await getProtected(`Bearer ${unknownSid}`)).toMatchObject(
      UNAUTHORIZED
    )
  })

  it('returns 404 when the user has been deleted', async () => {
    const { user, accessToken } = await createSessionForUser()
    await getTestPrisma().user.delete({ where: { id: user.id } })

    const res = await getProtected(`Bearer ${accessToken}`)
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('returns 403 when the user is disabled', async () => {
    const { user, accessToken } = await createSessionForUser()
    await getTestPrisma().user.update({
      where: { id: user.id },
      data: { disabledAt: new Date() }
    })

    const res = await getProtected(`Bearer ${accessToken}`)
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('prefers 401 over 403 when a disabled user also has a revoked session', async () => {
    const { user, accessToken } = await createSessionForUser()
    await getTestPrisma().user.update({
      where: { id: user.id },
      data: { disabledAt: new Date() }
    })
    await getTestPrisma().session.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() }
    })

    expect(await getProtected(`Bearer ${accessToken}`)).toMatchObject(
      UNAUTHORIZED
    )
  })
})
