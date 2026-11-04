import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSession } from '@/lib/auth-storage'

function session(accessToken: string, refreshToken = 'refresh-1'): AuthSession {
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 3_600_000,
    user: { id: 'user-1', email: 'a@example.com' }
  }
}

function tokenResponse(accessToken: string): Response {
  return new Response(
    JSON.stringify({
      data: {
        accessToken,
        refreshToken: `refresh-for-${accessToken}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: { id: 'user-1', email: 'a@example.com' }
      }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function rejection(status: number): Response {
  return new Response(
    JSON.stringify({ error: { code: 'INVALID', message: 'no' } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

let api: typeof import('../api')
let storage: typeof import('../auth-storage')

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.example.com')
  localStorage.clear()
  api = await import('../api')
  storage = await import('../auth-storage')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('refreshSessionAfterRejection', () => {
  it('returns null when nobody is signed in', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.refreshSessionAfterRejection('stale')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes even though the token has not expired by the clock', async () => {
    storage.setAuthSession(session('stale'))
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      tokenResponse('fresh')
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.refreshSessionAfterRejection('stale')

    expect(result?.accessToken).toBe('fresh')
    expect(storage.getAuthSession()?.accessToken).toBe('fresh')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      refreshToken: 'refresh-1'
    })
  })

  it('reuses a session another caller already refreshed', async () => {
    storage.setAuthSession(session('newer'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.refreshSessionAfterRejection('stale')

    expect(result?.accessToken).toBe('newer')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shares one refresh request between concurrent rejections', async () => {
    storage.setAuthSession(session('stale'))
    const fetchMock = vi.fn(async () => tokenResponse('fresh'))
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([
      api.refreshSessionAfterRejection('stale'),
      api.refreshSessionAfterRejection('stale'),
      api.refreshSessionAfterRejection('stale')
    ])

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(results.map(r => r?.accessToken)).toEqual([
      'fresh',
      'fresh',
      'fresh'
    ])
  })

  it('signs out and returns null when the refresh token is rejected', async () => {
    storage.setAuthSession(session('stale'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rejection(401))
    )

    await expect(api.refreshSessionAfterRejection('stale')).resolves.toBeNull()
    expect(storage.getAuthSession()).toBeNull()
  })

  it('keeps the session and returns null when the network is down', async () => {
    storage.setAuthSession(session('stale'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )

    await expect(api.refreshSessionAfterRejection('stale')).resolves.toBeNull()
    expect(storage.getAuthSession()?.accessToken).toBe('stale')
  })

  it('keeps the session when the server has a 5xx', async () => {
    storage.setAuthSession(session('stale'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rejection(503))
    )

    await expect(api.refreshSessionAfterRejection('stale')).resolves.toBeNull()
    expect(storage.getAuthSession()?.accessToken).toBe('stale')
  })
})
