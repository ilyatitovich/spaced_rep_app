import {
  SignJWT,
  UnsecuredJWT,
  exportJWK,
  generateKeyPair,
  type JWK,
  type CryptoKey
} from 'jose'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { getTestPrisma } from '../../../../testing/db/prisma.js'
import { userFactory } from '../../../../testing/factories/user.factory.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'

/**
 * Drives `POST /auth/oauth/google/callback` end to end. Google itself is
 * replaced at the `fetch` boundary: a token endpoint that returns ID tokens
 * signed with a test key, and a JWKS endpoint that publishes its public half.
 * The server verifies those tokens for real.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const KID = 'test-key'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URIS?.split(',')[0]?.trim() ?? ''
const CODE_VERIFIER = 'v'.repeat(64)

interface IdClaims {
  sub: string
  email?: string | undefined
  email_verified?: unknown
  picture?: string | undefined
}

interface MintOptions {
  audience?: string
  issuer?: string
  /** Seconds relative to now. */
  expiresIn?: number
  key?: CryptoKey
}

let signingKey: CryptoKey
let publicJwk: JWK
let strangerKey: CryptoKey

const googleCalls: Array<{ url: string; body: URLSearchParams | null }> = []
let tokenEndpoint: (body: URLSearchParams) => Response | Promise<Response>

async function mintIdToken(
  claims: IdClaims,
  options: MintOptions = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    ...(claims.email !== undefined ? { email: claims.email } : {}),
    ...(claims.email_verified !== undefined
      ? { email_verified: claims.email_verified }
      : {}),
    ...(claims.picture !== undefined ? { picture: claims.picture } : {})
  })
    .setProtectedHeader({ alg: 'ES256', kid: KID })
    .setSubject(claims.sub)
    .setIssuer(options.issuer ?? 'https://accounts.google.com')
    .setAudience(options.audience ?? CLIENT_ID)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + (options.expiresIn ?? 600))
    .sign(options.key ?? signingKey)
}

/** Token endpoint that answers every exchange with a token for `claims`. */
function respondWithIdToken(claims: IdClaims, options?: MintOptions) {
  tokenEndpoint = async () =>
    Response.json({ id_token: await mintIdToken(claims, options) })
}

const realFetch = globalThis.fetch

beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true })
  signingKey = pair.privateKey
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'ES256' }
  strangerKey = (await generateKeyPair('ES256')).privateKey
})

beforeEach(() => {
  googleCalls.length = 0
  tokenEndpoint = () =>
    Response.json({ error: 'not configured' }, { status: 500 })

  vi.stubGlobal(
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === TOKEN_URL) {
        const body = new URLSearchParams(String(init?.body ?? ''))
        googleCalls.push({ url, body })
        return tokenEndpoint(body)
      }
      if (url === JWKS_URL) {
        googleCalls.push({ url, body: null })
        return Response.json({ keys: [publicJwk] })
      }
      return realFetch(input, init)
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function callback(body: Record<string, unknown> = {}) {
  const agent = await createTestAgent()
  return agent.post('/auth/oauth/google/callback').send({
    code: 'auth-code',
    codeVerifier: CODE_VERIFIER,
    redirectUri: REDIRECT_URI,
    ...body
  })
}

function uniqueSub(): string {
  return `sub-${Math.random().toString(36).slice(2, 12)}`
}

function uniqueEmail(label = 'google'): string {
  return `${label}-${Math.random().toString(36).slice(2, 10)}@example.com`
}

async function expectNoAccountCreated() {
  expect(await getTestPrisma().user.count()).toBe(0)
  expect(await getTestPrisma().oAuthIdentity.count()).toBe(0)
  expect(await getTestPrisma().session.count()).toBe(0)
}

describe('resolving the Google account', () => {
  it('creates a verified user, identity and OAUTH session for a new account', async () => {
    const sub = uniqueSub()
    const email = uniqueEmail('new')
    respondWithIdToken({
      sub,
      email: email.toUpperCase(),
      email_verified: true,
      picture: 'https://lh3.example/avatar.png'
    })

    const res = await callback()

    expect(res.status).toBe(200)
    expect(res.body.data.user.email).toBe(email)

    const user = await getTestPrisma().user.findUniqueOrThrow({
      where: { email },
      include: { oauthIdentities: true, sessions: true }
    })
    expect(user.emailVerifiedAt).toEqual(expect.any(Date))
    expect(user.avatarUrl).toBe('https://lh3.example/avatar.png')
    expect(user.oauthIdentities).toEqual([
      expect.objectContaining({
        provider: 'google',
        providerUserId: sub,
        email
      })
    ])
    expect(user.sessions).toEqual([
      expect.objectContaining({ authMethod: 'OAUTH', revokedAt: null })
    ])

    const agent = await createTestAgent()
    const me = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
    expect(me.status).toBe(200)
  })

  it('sends the PKCE exchange to Google with the server credentials', async () => {
    respondWithIdToken({
      sub: uniqueSub(),
      email: uniqueEmail(),
      email_verified: true
    })

    await callback({ code: 'the-code' })

    const exchange = googleCalls.find(c => c.url === TOKEN_URL)?.body
    expect(Object.fromEntries(exchange ?? [])).toEqual({
      code: 'the-code',
      client_id: CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: CODE_VERIFIER
    })
  })

  it('signs the same Google account into the same user every time', async () => {
    const claims = {
      sub: uniqueSub(),
      email: uniqueEmail(),
      email_verified: true
    }
    respondWithIdToken(claims)

    const first = await callback()
    const second = await callback()

    expect(second.body.data.user.id).toBe(first.body.data.user.id)
    expect(await getTestPrisma().user.count()).toBe(1)
    expect(await getTestPrisma().oAuthIdentity.count()).toBe(1)
    expect(await getTestPrisma().session.count()).toBe(2)
  })

  it('follows the identity when the Google email changes', async () => {
    const sub = uniqueSub()
    const original = uniqueEmail('before')
    const renamed = uniqueEmail('after')
    respondWithIdToken({ sub, email: original, email_verified: true })
    const first = await callback()

    respondWithIdToken({ sub, email: renamed, email_verified: true })
    const second = await callback()

    expect(second.status).toBe(200)
    expect(second.body.data.user.id).toBe(first.body.data.user.id)
    expect(second.body.data.user.email).toBe(original)
    const identity = await getTestPrisma().oAuthIdentity.findFirstOrThrow({
      where: { providerUserId: sub }
    })
    expect(identity.email).toBe(renamed)
  })

  it('refreshes the avatar but never wipes it when Google sends none', async () => {
    const claims = {
      sub: uniqueSub(),
      email: uniqueEmail(),
      email_verified: true
    }
    respondWithIdToken({ ...claims, picture: 'https://lh3.example/one.png' })
    const first = await callback()
    const userId = first.body.data.user.id as string

    respondWithIdToken({ ...claims, picture: 'https://lh3.example/two.png' })
    await callback()
    expect(
      (await getTestPrisma().user.findUniqueOrThrow({ where: { id: userId } }))
        .avatarUrl
    ).toBe('https://lh3.example/two.png')

    respondWithIdToken(claims)
    await callback()
    expect(
      (await getTestPrisma().user.findUniqueOrThrow({ where: { id: userId } }))
        .avatarUrl
    ).toBe('https://lh3.example/two.png')
  })

  it('links a Google account to an existing user with the same verified email', async () => {
    const email = uniqueEmail('existing')
    const existing = await userFactory.create({ email })
    const sub = uniqueSub()
    respondWithIdToken({ sub, email, email_verified: true })

    const res = await callback()

    expect(res.status).toBe(200)
    expect(res.body.data.user.id).toBe(existing.id)
    expect(await getTestPrisma().user.count()).toBe(1)
    expect(
      await getTestPrisma().oAuthIdentity.count({
        where: { userId: existing.id, provider: 'google', providerUserId: sub }
      })
    ).toBe(1)
  })

  it('creates one user and identity when the same new account signs in concurrently', async () => {
    respondWithIdToken({
      sub: uniqueSub(),
      email: uniqueEmail('race'),
      email_verified: true
    })

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => callback())
    )

    expect(responses.map(r => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(new Set(responses.map(r => r.body.data.user.id)).size).toBe(1)
    expect(await getTestPrisma().user.count()).toBe(1)
    expect(await getTestPrisma().oAuthIdentity.count()).toBe(1)
  })

  it('rejects a disabled user reached through their Google identity', async () => {
    const claims = {
      sub: uniqueSub(),
      email: uniqueEmail(),
      email_verified: true
    }
    respondWithIdToken(claims)
    const first = await callback()
    await getTestPrisma().user.update({
      where: { id: first.body.data.user.id },
      data: { disabledAt: new Date() }
    })
    const sessionsBefore = await getTestPrisma().session.count()

    const res = await callback()

    expect(res.status).toBe(403)
    expect(res.body.error?.code).toBe('FORBIDDEN')
    expect(await getTestPrisma().session.count()).toBe(sessionsBefore)
  })

  it('rejects a disabled user reached through a matching email, without linking', async () => {
    const email = uniqueEmail('disabled')
    const user = await userFactory.create({ email })
    await getTestPrisma().user.update({
      where: { id: user.id },
      data: { disabledAt: new Date() }
    })
    respondWithIdToken({ sub: uniqueSub(), email, email_verified: true })

    const res = await callback()

    expect(res.status).toBe(403)
    expect(await getTestPrisma().oAuthIdentity.count()).toBe(0)
    expect(await getTestPrisma().session.count()).toBe(0)
  })
})

describe('request validation', () => {
  it('rejects a redirect URI outside the allowlist before calling Google', async () => {
    respondWithIdToken({
      sub: uniqueSub(),
      email: uniqueEmail(),
      email_verified: true
    })

    const res = await callback({ redirectUri: 'https://evil.example/callback' })

    expect(res.status).toBe(400)
    expect(googleCalls).toEqual([])
    await expectNoAccountCreated()
  })

  it.each([
    ['a missing code', { code: '' }],
    ['a too-short code verifier', { codeVerifier: 'short' }],
    ['a too-long code verifier', { codeVerifier: 'v'.repeat(129) }],
    ['a redirect URI that is not a URL', { redirectUri: 'not a url' }]
  ])('rejects %s', async (_label, override) => {
    const res = await callback(override)

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
    expect(googleCalls).toEqual([])
  })
})

describe('Google token endpoint failures', () => {
  it('maps a Google 4xx to GOOGLE_EXCHANGE_FAILED with Googles message', async () => {
    tokenEndpoint = () =>
      Response.json(
        {
          error: 'invalid_grant',
          error_description: 'Bad Request: code expired'
        },
        { status: 400 }
      )

    const res = await callback()

    expect(res.status).toBe(400)
    expect(res.body.error).toEqual({
      code: 'GOOGLE_EXCHANGE_FAILED',
      message: 'Bad Request: code expired'
    })
    await expectNoAccountCreated()
  })

  it('maps a Google 5xx to a 502', async () => {
    tokenEndpoint = () =>
      Response.json({ error: 'backend_error' }, { status: 503 })

    const res = await callback()

    expect(res.status).toBe(502)
    expect(res.body.error?.code).toBe('BAD_GATEWAY')
    await expectNoAccountCreated()
  })

  it('maps a non-JSON gateway error page from Google to a 502', async () => {
    tokenEndpoint = () =>
      new Response('<html>Bad Gateway</html>', { status: 502 })

    const res = await callback()

    expect(res.status).toBe(502)
    expect(res.body.error?.code).toBe('BAD_GATEWAY')
    await expectNoAccountCreated()
  })

  it('maps an unreachable Google to a 502', async () => {
    tokenEndpoint = () => {
      throw new TypeError('fetch failed')
    }

    const res = await callback()

    expect(res.status).toBe(502)
    expect(res.body.error?.code).toBe('BAD_GATEWAY')
  })

  it('rejects a successful response that has no id_token', async () => {
    tokenEndpoint = () => Response.json({ access_token: 'only-this' })

    const res = await callback()

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('GOOGLE_EXCHANGE_FAILED')
    await expectNoAccountCreated()
  })
})

describe('ID token verification', () => {
  const valid = () => ({
    sub: uniqueSub(),
    email: uniqueEmail('claims'),
    email_verified: true
  })

  it('accepts the bare accounts.google.com issuer', async () => {
    respondWithIdToken(valid(), { issuer: 'accounts.google.com' })

    expect((await callback()).status).toBe(200)
  })

  it.each<[string, MintOptions]>([
    [
      'issued for another client (audience)',
      { audience: 'someone-elses-client' }
    ],
    ['from another issuer', { issuer: 'https://evil.example' }],
    ['expired', { expiresIn: -120 }]
  ])('rejects a token that is %s', async (_label, options) => {
    respondWithIdToken(valid(), options)

    const res = await callback()

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('UNAUTHORIZED')
    await expectNoAccountCreated()
  })

  it('rejects a token signed with a key Google does not publish', async () => {
    respondWithIdToken(valid(), { key: strangerKey })

    const res = await callback()

    expect(res.status).toBe(401)
    await expectNoAccountCreated()
  })

  it('rejects an unsigned token (alg: none)', async () => {
    const claims = valid()
    tokenEndpoint = () =>
      Response.json({
        id_token: new UnsecuredJWT({
          email: claims.email,
          email_verified: true
        })
          .setSubject(claims.sub)
          .setIssuer('https://accounts.google.com')
          .setAudience(CLIENT_ID)
          .setExpirationTime('10m')
          .encode()
      })

    const res = await callback()

    expect(res.status).toBe(401)
    await expectNoAccountCreated()
  })

  it('rejects a token that is not a JWT', async () => {
    tokenEndpoint = () => Response.json({ id_token: 'garbage' })

    expect((await callback()).status).toBe(401)
    await expectNoAccountCreated()
  })

  it.each([
    ['an unverified email', { email_verified: false }],
    ['a missing email_verified claim', { email_verified: undefined }],
    ['email_verified sent as a string', { email_verified: 'true' }]
  ])(
    'rejects %s so it cannot take over an account',
    async (_label, override) => {
      const email = uniqueEmail('victim')
      await userFactory.create({ email })
      respondWithIdToken({ sub: uniqueSub(), email, ...override })

      const res = await callback()

      expect(res.status).toBe(400)
      expect(await getTestPrisma().oAuthIdentity.count()).toBe(0)
      expect(await getTestPrisma().session.count()).toBe(0)
    }
  )

  it('rejects a token without an email', async () => {
    respondWithIdToken({ sub: uniqueSub(), email_verified: true })

    const res = await callback()

    expect(res.status).toBe(400)
    await expectNoAccountCreated()
  })

  it('rejects a token without a subject', async () => {
    const now = Math.floor(Date.now() / 1000)
    const noSub = await new SignJWT({
      email: uniqueEmail(),
      email_verified: true
    })
      .setProtectedHeader({ alg: 'ES256', kid: KID })
      .setIssuer('https://accounts.google.com')
      .setAudience(CLIENT_ID)
      .setIssuedAt(now - 60)
      .setExpirationTime(now + 600)
      .sign(signingKey)
    tokenEndpoint = () => Response.json({ id_token: noSub })

    const res = await callback()

    expect(res.status).toBe(401)
    await expectNoAccountCreated()
  })
})
