import { startAuthentication } from '@simplewebauthn/browser'
import { freshSession, getSession, signInWithPasskey, signOut } from './auth'

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

describe('freshSession', () => {
  const expired = {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    expiresAt: Date.now() - 1000,
    user: { id: 'user-1', email: 'a@b.com' }
  }

  function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  beforeEach(() => {
    values['auth.session'] = { ...expired }
  })

  it('returns the stored session without a request while the token is valid', async () => {
    const valid = { ...expired, expiresAt: Date.now() + 10 * 60_000 }
    values['auth.session'] = valid
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await freshSession()).toEqual(valid)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores the rotated session on a successful refresh', async () => {
    globalThis.fetch = (async () =>
      jsonResponse(200, {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: 900,
          user: { id: 'user-1', email: 'a@b.com' }
        }
      })) as typeof fetch

    const session = await freshSession()

    expect(session?.accessToken).toBe('new-access')
    expect((await getSession())?.refreshToken).toBe('new-refresh')
  })

  describe('keeps the stored session when the refresh could not be judged', () => {
    it('on a network error (offline)', async () => {
      globalThis.fetch = (async () => {
        throw new TypeError('Failed to fetch')
      }) as typeof fetch

      await freshSession()

      expect(await getSession()).toEqual(expired)
    })

    it.each([500, 502, 503])('on a %i from the server', async status => {
      globalThis.fetch = (async () =>
        jsonResponse(status, {
          error: { message: 'Internal server error' }
        })) as typeof fetch

      await freshSession()

      expect(await getSession()).toEqual(expired)
    })

    it('on a non-JSON gateway error page', async () => {
      globalThis.fetch = (async () =>
        new Response('<html>Bad Gateway</html>', {
          status: 502
        })) as typeof fetch

      await freshSession()

      expect(await getSession()).toEqual(expired)
    })

    it('and returns that session so callers can retry later', async () => {
      globalThis.fetch = (async () => {
        throw new TypeError('Failed to fetch')
      }) as typeof fetch

      expect(await freshSession()).toEqual(expired)
    })
  })

  describe('clears the stored session when the server rejects the refresh token', () => {
    it.each([401, 403])('on a %i', async status => {
      globalThis.fetch = (async () =>
        jsonResponse(status, {
          error: { message: 'Invalid refresh token' }
        })) as typeof fetch

      expect(await freshSession()).toBeNull()
      expect(await getSession()).toBeNull()
    })
  })
})
