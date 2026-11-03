import { createHash, randomBytes } from 'node:crypto'
import { createClient } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getTestEnv } from '../../../../testing/config/env.js'
import { getTestPrisma } from '../../../../testing/db/prisma.js'
import {
  createSessionForUser,
  type AuthTokens
} from '../../../../testing/helpers/auth/session.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'

/**
 * Extension sign-in: an authenticated web session mints a one-time code
 * (`/auth/extension/grant`), the extension trades it for its own session
 * (`/auth/extension/token`) with a PKCE verifier. Runs against real Redis.
 */

const [REDIRECT_URI = '', OTHER_REDIRECT_URI = ''] = (
  process.env.EXTENSION_REDIRECT_URIS ?? ''
)
  .split(',')
  .map(uri => uri.trim())
const KEY_PREFIX = 'auth:extension:'

type RedisClient = ReturnType<typeof createClient>
let redis: RedisClient

beforeAll(async () => {
  redis = createClient({ url: getTestEnv().redisUrl })
  await redis.connect()
})

afterAll(async () => {
  await redis.quit()
})

interface Pkce {
  verifier: string
  challenge: string
}

function newPkce(): Pkce {
  const verifier = randomBytes(48).toString('base64url')
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url')
  }
}

async function grant(
  tokens: AuthTokens,
  overrides: Record<string, unknown> = {},
  pkce: Pkce = newPkce()
) {
  const agent = await createTestAgent()
  return agent
    .post('/auth/extension/grant')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .send({
      redirectUri: REDIRECT_URI,
      state: 's'.repeat(24),
      codeChallenge: pkce.challenge,
      ...overrides
    })
}

async function exchange(body: Record<string, unknown>) {
  const agent = await createTestAgent()
  return agent.post('/auth/extension/token').send({
    redirectUri: REDIRECT_URI,
    ...body
  })
}

/** Grant + exchange inputs for a fresh user. */
async function issued(overrides: Record<string, unknown> = {}) {
  const tokens = await createSessionForUser()
  const pkce = newPkce()
  const res = await grant(tokens, overrides, pkce)
  expect(res.status).toBe(200)
  return {
    tokens,
    pkce,
    code: res.body.data.code as string,
    state: res.body.data.state as string
  }
}

async function storedGrantKeys() {
  return redis.keys(`${KEY_PREFIX}*`)
}

describe('test environment', () => {
  it('allowlists two distinct extension redirect URIs', () => {
    expect(REDIRECT_URI).not.toBe('')
    expect(OTHER_REDIRECT_URI).not.toBe('')
    expect(OTHER_REDIRECT_URI).not.toBe(REDIRECT_URI)
  })
})

describe('creating a grant', () => {
  it('requires an authenticated session', async () => {
    const agent = await createTestAgent()

    const res = await agent.post('/auth/extension/grant').send({
      redirectUri: REDIRECT_URI,
      state: 's'.repeat(24),
      codeChallenge: newPkce().challenge
    })

    expect(res.status).toBe(401)
    expect(await storedGrantKeys()).toEqual([])
  })

  it('returns a code and echoes the state', async () => {
    const tokens = await createSessionForUser()

    const res = await grant(tokens, { state: 'my-state-my-state-my-state' })

    expect(res.status).toBe(200)
    expect(res.body.data.state).toBe('my-state-my-state-my-state')
    expect(res.body.data.code.length).toBeGreaterThanOrEqual(32)
  })

  it('stores the grant in Redis for the caller with a short TTL', async () => {
    const tokens = await createSessionForUser()
    const pkce = newPkce()

    const res = await grant(tokens, {}, pkce)

    const key = `${KEY_PREFIX}${res.body.data.code}`
    expect(JSON.parse((await redis.get(key)) ?? 'null')).toEqual({
      userId: tokens.user.id,
      redirectUri: REDIRECT_URI,
      state: 's'.repeat(24),
      codeChallenge: pkce.challenge
    })
    const ttl = await redis.ttl(key)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(120)
  })

  it('issues a different code every time', async () => {
    const tokens = await createSessionForUser()

    const codes = await Promise.all(
      Array.from(
        { length: 5 },
        async () => (await grant(tokens)).body.data.code
      )
    )

    expect(new Set(codes).size).toBe(5)
  })

  it('rejects a redirect URI that is not allowlisted and stores nothing', async () => {
    const tokens = await createSessionForUser()

    const res = await grant(tokens, {
      redirectUri: 'https://attacker.example/authorized'
    })

    expect(res.status).toBe(400)
    expect(await storedGrantKeys()).toEqual([])
  })

  it.each([
    ['a short state', { state: 'short' }],
    ['a short code challenge', { codeChallenge: 'c'.repeat(42) }],
    ['a redirect URI that is not a URL', { redirectUri: 'not a url' }]
  ])('rejects %s', async (_label, override) => {
    const tokens = await createSessionForUser()

    const res = await grant(tokens, override)

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
    expect(await storedGrantKeys()).toEqual([])
  })
})

describe('exchanging a grant', () => {
  it('returns a session for the user who created the grant', async () => {
    const { tokens, pkce, code } = await issued()

    const res = await exchange({ code, codeVerifier: pkce.verifier })

    expect(res.status).toBe(200)
    expect(res.body.data.user.id).toBe(tokens.user.id)

    const agent = await createTestAgent()
    const me = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
    expect(me.status).toBe(200)
    expect(me.body.data.user.id).toBe(tokens.user.id)
  })

  it('creates a separate session tagged as the browser extension', async () => {
    const { tokens, pkce, code } = await issued()

    await exchange({ code, codeVerifier: pkce.verifier })

    const sessions = await getTestPrisma().session.findMany({
      where: { userId: tokens.user.id },
      orderBy: { createdAt: 'asc' }
    })
    expect(sessions).toHaveLength(2)
    const [, extensionSession] = sessions
    expect(extensionSession).toMatchObject({
      authMethod: 'OAUTH',
      revokedAt: null
    })
    const event = await getTestPrisma().securityEvent.findFirstOrThrow({
      where: { sessionId: extensionSession?.id ?? '' }
    })
    expect(event.metadata).toEqual({ client: 'browser-extension' })
  })

  it('keeps the extension session alive when the web session signs out', async () => {
    const { tokens, pkce, code } = await issued()
    const res = await exchange({ code, codeVerifier: pkce.verifier })
    const agent = await createTestAgent()
    await agent
      .post('/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)

    const me = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)

    expect(me.status).toBe(200)
  })

  it('removes the grant from Redis once it is used', async () => {
    const { pkce, code } = await issued()

    await exchange({ code, codeVerifier: pkce.verifier })

    expect(await redis.exists(`${KEY_PREFIX}${code}`)).toBe(0)
  })

  it('is single use', async () => {
    const { pkce, code } = await issued()

    expect((await exchange({ code, codeVerifier: pkce.verifier })).status).toBe(
      200
    )
    const replay = await exchange({ code, codeVerifier: pkce.verifier })

    expect(replay.status).toBe(401)
    expect(await getTestPrisma().session.count()).toBe(2)
  })

  it('lets exactly one of many concurrent exchanges win', async () => {
    const { pkce, code } = await issued()

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        exchange({ code, codeVerifier: pkce.verifier })
      )
    )

    expect(responses.filter(r => r.status === 200)).toHaveLength(1)
    expect(responses.filter(r => r.status === 401)).toHaveLength(4)
    // The web session plus exactly one extension session.
    expect(await getTestPrisma().session.count()).toBe(2)
  })

  it('rejects an unknown code', async () => {
    const res = await exchange({
      code: randomBytes(32).toString('base64url'),
      codeVerifier: newPkce().verifier
    })

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('UNAUTHORIZED')
  })

  it('rejects a code after its Redis TTL runs out', async () => {
    const { pkce, code } = await issued()
    await redis.pExpire(`${KEY_PREFIX}${code}`, 1)
    await new Promise(resolve => setTimeout(resolve, 20))

    const res = await exchange({ code, codeVerifier: pkce.verifier })

    expect(res.status).toBe(401)
    expect(await getTestPrisma().session.count()).toBe(1)
  })

  it('rejects the wrong PKCE verifier', async () => {
    const { code } = await issued()

    const res = await exchange({ code, codeVerifier: newPkce().verifier })

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('UNAUTHORIZED')
    expect(await getTestPrisma().session.count()).toBe(1)
  })

  // A wrong verifier burns the code, so the verifier cannot be brute forced
  // against one grant.
  it('burns the code after a wrong verifier, even for the right one', async () => {
    const { pkce, code } = await issued()

    await exchange({ code, codeVerifier: newPkce().verifier })
    const retry = await exchange({ code, codeVerifier: pkce.verifier })

    expect(retry.status).toBe(401)
    expect(await getTestPrisma().session.count()).toBe(1)
  })

  it('rejects a redirect URI that differs from the grants, and burns the code', async () => {
    const { pkce, code } = await issued()

    const mismatch = await exchange({
      code,
      codeVerifier: pkce.verifier,
      redirectUri: OTHER_REDIRECT_URI
    })
    const retry = await exchange({ code, codeVerifier: pkce.verifier })

    expect(mismatch.status).toBe(401)
    expect(retry.status).toBe(401)
    expect(await getTestPrisma().session.count()).toBe(1)
  })

  it('rejects a redirect URI that is not allowlisted without burning the code', async () => {
    const { pkce, code } = await issued()

    const rejected = await exchange({
      code,
      codeVerifier: pkce.verifier,
      redirectUri: 'https://attacker.example/authorized'
    })
    const retry = await exchange({ code, codeVerifier: pkce.verifier })

    expect(rejected.status).toBe(400)
    expect(retry.status).toBe(200)
  })

  it.each([
    ['a short code', { code: 'c'.repeat(31) }],
    ['a short verifier', { codeVerifier: 'v'.repeat(42) }],
    ['a redirect URI that is not a URL', { redirectUri: 'not a url' }]
  ])('rejects %s', async (_label, override) => {
    const { pkce, code } = await issued()

    const res = await exchange({
      code,
      codeVerifier: pkce.verifier,
      ...override
    })

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('refuses a disabled user, and the grant is spent', async () => {
    const { tokens, pkce, code } = await issued()
    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })

    const res = await exchange({ code, codeVerifier: pkce.verifier })

    expect(res.status).toBe(403)
    expect(await getTestPrisma().session.count()).toBe(1)
    expect(await redis.exists(`${KEY_PREFIX}${code}`)).toBe(0)
  })

  it('refuses a user whose account was deleted after the grant', async () => {
    const { tokens, pkce, code } = await issued()
    await getTestPrisma().user.delete({ where: { id: tokens.user.id } })

    const res = await exchange({ code, codeVerifier: pkce.verifier })

    expect(res.status).toBe(401)
    expect(await getTestPrisma().session.count()).toBe(0)
  })
})
