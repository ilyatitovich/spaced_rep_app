import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function authorizationOf(init?: RequestInit): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

const refreshed = {
  data: {
    accessToken: 'fresh',
    refreshToken: 'refresh-2',
    expiresIn: 3600,
    tokenType: 'Bearer',
    user: { id: 'user-1', email: 'a@example.com' }
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.example.com')
  localStorage.setItem(
    'auth.session',
    JSON.stringify({
      accessToken: 'stale',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 3_600_000,
      user: { id: 'user-1', email: 'a@example.com' }
    })
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('media requests', () => {
  it('refresh the session and replay once when the server answers 401', async () => {
    const calls: Array<{ url: string; auth: string | undefined }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const auth = authorizationOf(init)
        calls.push({ url, auth })
        if (url.endsWith('/auth/token/refresh')) return json(200, refreshed)
        if (auth === 'Bearer stale') {
          return json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } })
        }
        return json(200, { data: { items: [] } })
      })
    )
    const { httpSyncMediaApi } = await import('../sync-http.client')

    await expect(httpSyncMediaApi.planDownloads(['hash'])).resolves.toEqual([])

    expect(
      calls.map(c => c.url.replace('https://api.example.com', ''))
    ).toEqual([
      '/sync/media/downloads',
      '/auth/token/refresh',
      '/sync/media/downloads'
    ])
    expect(calls[2]?.auth).toBe('Bearer fresh')
  })

  it('surface the 401 when the session cannot be refreshed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/token/refresh')
          ? json(401, { error: { code: 'INVALID', message: 'revoked' } })
          : json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } })
      )
    )
    const { httpSyncMediaApi } = await import('../sync-http.client')

    await expect(
      httpSyncMediaApi.planDownloads(['hash'])
    ).rejects.toMatchObject({
      status: 401
    })
  })
})

describe('sync requests', () => {
  it('refresh the session and replay once when the server answers 401', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const auth = authorizationOf(init)
        if (url.endsWith('/auth/token/refresh')) return json(200, refreshed)
        seen.push(auth ?? '')
        if (auth === 'Bearer stale') {
          return json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } })
        }
        const request = JSON.parse(String(init?.body)) as {
          messageId: string
          deviceId: string
        }
        return json(200, {
          version: 2,
          messageId: crypto.randomUUID(),
          correlationId: request.messageId,
          deviceId: request.deviceId,
          sentAt: Date.now(),
          kind: 'pullDelta',
          pullDelta: { records: [], watermark: '1', more: false }
        })
      })
    )
    const { httpPull } = await import('../sync-http.client')

    await expect(
      httpPull({ deviceId: crypto.randomUUID(), since: '0' })
    ).resolves.toMatchObject({ more: false })

    expect(seen).toEqual(['Bearer stale', 'Bearer fresh'])
  })
})
