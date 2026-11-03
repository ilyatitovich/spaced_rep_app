import { startAuthentication } from '@simplewebauthn/browser'
import { getSession, signInWithPasskey, signOut, verifyEmailOtp } from './auth'

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn()
}))

const values: Record<string, unknown> = {}

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key]
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) =>
          Object.assign(values, next),
        remove: async (key: string) => {
          delete values[key]
        }
      }
    }
  } as unknown as typeof chrome
})

it('stores the session returned by email verification', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: {
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresIn: 900,
          user: { id: 'user-1', email: 'a@b.com' }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch

  const session = await verifyEmailOtp('a@b.com', '123456')
  expect(session.user.email).toBe('a@b.com')
  expect(await getSession()).toEqual(session)
})

it('stores the session returned by passkey verification', async () => {
  vi.mocked(startAuthentication).mockResolvedValue({
    id: 'cred',
    rawId: 'cred',
    type: 'public-key',
    response: {
      clientDataJSON: 'x',
      authenticatorData: 'y',
      signature: 'z',
      userHandle: 'u'
    },
    clientExtensionResults: {}
  })

  const tokens = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 900,
    user: { id: 'user-1', email: 'a@b.com' }
  }
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    const data = calls === 1 ? { challenge: 'c', rpId: 'localhost' } : tokens
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }) as typeof fetch

  const session = await signInWithPasskey()
  expect(session.user.email).toBe('a@b.com')
  expect(await getSession()).toEqual(session)
})

it('revokes the refresh session on sign-out then clears storage', async () => {
  values['auth.session'] = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 60_000,
    user: { id: 'user-1', email: 'a@b.com' }
  }

  const calls: Array<{ url: string; init?: RequestInit | undefined }> = []
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }) as typeof fetch

  await signOut()

  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toMatch(/\/auth\/logout$/)
  expect(calls[0]?.init?.headers).toMatchObject({
    Authorization: 'Bearer access'
  })
  expect(await getSession()).toBeNull()
})
