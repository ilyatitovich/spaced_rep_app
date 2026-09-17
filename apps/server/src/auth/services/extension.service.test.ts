const mocks = vi.hoisted(() => {
  const values = new Map<string, string>()
  return {
    values,
    redis: {
      isOpen: true,
      connect: vi.fn(),
      set: vi.fn(async (key: string, value: string) => {
        values.set(key, value)
        return 'OK'
      }),
      getDel: vi.fn(async (key: string) => {
        const value = values.get(key) ?? null
        values.delete(key)
        return value
      })
    },
    createSession: vi.fn(async () => ({ accessToken: 'access' }))
  }
})

vi.mock('../../shared/config/env.js', () => ({
  env: {
    EXTENSION_REDIRECT_URIS: ['https://extension-id.chromiumapp.org/authorized']
  }
}))
vi.mock('../../shared/lib/redis.js', () => ({
  getRedis: () => mocks.redis
}))
vi.mock('./session.service.js', () => ({
  createSessionWithTokens: mocks.createSession
}))

import {
  createExtensionGrant,
  exchangeExtensionGrant
} from './extension.service.js'

beforeEach(() => {
  mocks.values.clear()
  vi.clearAllMocks()
})

it('consumes a valid extension grant exactly once', async () => {
  const verifier = 'v'.repeat(43)
  const codeChallenge = await crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(verifier))
    .then(value => Buffer.from(value).toString('base64url'))
  const redirectUri = 'https://extension-id.chromiumapp.org/authorized'
  const grant = await createExtensionGrant({
    userId: crypto.randomUUID(),
    redirectUri,
    state: 'state-state-state-state',
    codeChallenge
  })

  await expect(
    exchangeExtensionGrant({
      code: grant.code,
      codeVerifier: verifier,
      redirectUri
    })
  ).resolves.toEqual({ accessToken: 'access' })
  await expect(
    exchangeExtensionGrant({
      code: grant.code,
      codeVerifier: verifier,
      redirectUri
    })
  ).rejects.toThrow('Invalid or expired extension code')
})

it('rejects an unconfigured redirect before creating a grant', async () => {
  await expect(
    createExtensionGrant({
      userId: crypto.randomUUID(),
      redirectUri: 'https://attacker.example/callback',
      state: 'state-state-state-state',
      codeChallenge: 'c'.repeat(43)
    })
  ).rejects.toThrow('Invalid extension redirect URI')
})
