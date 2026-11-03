import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/lib/auth-storage'

const API_URL = 'https://api.test'

const expiredSession: AuthSession = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: Date.now() - 1000,
  user: { id: 'user-1', email: 'a@b.com' }
}

const refreshedBody = {
  data: {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    expiresIn: 900,
    tokenType: 'Bearer',
    user: { id: 'user-1', email: 'a@b.com' }
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function load() {
  // `api.ts` reads VITE_API_URL at import time.
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', API_URL)
  const api = await import('@/lib/api')
  const storage = await import('@/lib/auth-storage')
  return { ...api, ...storage }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('ensureFreshSession', () => {
  it('returns the stored session untouched while the access token is still valid', async () => {
    const { ensureFreshSession, setAuthSession } = await load()
    const valid = { ...expiredSession, expiresAt: Date.now() + 10 * 60_000 }
    setAuthSession(valid)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await ensureFreshSession()).toEqual(valid)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores and returns the rotated session on a successful refresh', async () => {
    const { ensureFreshSession, getAuthSession, setAuthSession } = await load()
    setAuthSession(expiredSession)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, refreshedBody))
    )

    const session = await ensureFreshSession()

    expect(session?.accessToken).toBe('new-access')
    expect(getAuthSession()?.refreshToken).toBe('new-refresh')
  })

  it('shares one refresh request between concurrent callers', async () => {
    const { ensureFreshSession, setAuthSession } = await load()
    setAuthSession(expiredSession)
    const fetchMock = vi.fn(async () => jsonResponse(200, refreshedBody))
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([ensureFreshSession(), ensureFreshSession()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  describe('keeps the stored session when the refresh could not be judged', () => {
    it('on a network error (offline)', async () => {
      const { ensureFreshSession, getAuthSession, setAuthSession } =
        await load()
      setAuthSession(expiredSession)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        })
      )

      await ensureFreshSession()

      expect(getAuthSession()).toEqual(expiredSession)
    })

    it.each([500, 502, 503])('on a %i from the server', async status => {
      const { ensureFreshSession, getAuthSession, setAuthSession } =
        await load()
      setAuthSession(expiredSession)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          jsonResponse(status, { error: { code: 'INTERNAL_ERROR' } })
        )
      )

      await ensureFreshSession()

      expect(getAuthSession()).toEqual(expiredSession)
    })

    it('on a non-JSON gateway error page', async () => {
      const { ensureFreshSession, getAuthSession, setAuthSession } =
        await load()
      setAuthSession(expiredSession)
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () => new Response('<html>Bad Gateway</html>', { status: 502 })
        )
      )

      await ensureFreshSession()

      expect(getAuthSession()).toEqual(expiredSession)
    })

    it('and returns that session so callers can retry later', async () => {
      const { ensureFreshSession, setAuthSession } = await load()
      setAuthSession(expiredSession)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        })
      )

      expect(await ensureFreshSession()).toEqual(expiredSession)
    })

    it('and can refresh successfully once the network is back', async () => {
      const { ensureFreshSession, getAuthSession, setAuthSession } =
        await load()
      setAuthSession(expiredSession)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        })
      )
      await ensureFreshSession()

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse(200, refreshedBody))
      )
      await ensureFreshSession()

      expect(getAuthSession()?.accessToken).toBe('new-access')
    })
  })

  describe('clears the stored session when the server rejects the refresh token', () => {
    it.each([
      [401, 'UNAUTHORIZED'],
      [401, 'REFRESH_REUSE'],
      [403, 'FORBIDDEN']
    ])('on a %i (%s)', async (status, code) => {
      const { ensureFreshSession, getAuthSession, setAuthSession } =
        await load()
      setAuthSession(expiredSession)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse(status, { error: { code } }))
      )

      expect(await ensureFreshSession()).toBeNull()
      expect(getAuthSession()).toBeNull()
    })
  })
})
