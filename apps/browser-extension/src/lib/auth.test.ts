import { startAuthentication } from '@simplewebauthn/browser'
import { getSession, signInWithPasskey, verifyEmailOtp } from './auth'

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
          Object.assign(values, next)
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
