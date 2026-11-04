import { createHttpSyncClient, SyncHttpError } from './index'

it('creates and validates a bootstrap envelope', async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as {
      messageId: string
      deviceId: string
    }
    return new Response(
      JSON.stringify({
        version: 2,
        messageId: crypto.randomUUID(),
        correlationId: request.messageId,
        deviceId: request.deviceId,
        sentAt: Date.now(),
        kind: 'pullDelta',
        pullDelta: {
          records: [],
          watermark: new Date().toISOString(),
          more: false
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  const client = createHttpSyncClient({
    apiUrl: 'https://api.example.com/',
    getAccessToken: async () => 'token'
  })

  await expect(
    client.bootstrap(crypto.randomUUID(), new Date(0).toISOString(), 0)
  ).resolves.toMatchObject({ records: [], more: false })
  expect(fetchMock).toHaveBeenCalledOnce()
})

it('preserves server error codes', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'PLAN_REQUIRED', message: 'Upgrade' }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
    )
  )
  const client = createHttpSyncClient({
    apiUrl: 'https://api.example.com',
    getAccessToken: async () => 'token'
  })

  await expect(
    client.pull(crypto.randomUUID(), new Date(0).toISOString())
  ).rejects.toMatchObject<Partial<SyncHttpError>>({
    status: 403,
    code: 'PLAN_REQUIRED'
  })
})

function pullDeltaResponse(request: { messageId: string; deviceId: string }) {
  return new Response(
    JSON.stringify({
      version: 2,
      messageId: crypto.randomUUID(),
      correlationId: request.messageId,
      deviceId: request.deviceId,
      sentAt: Date.now(),
      kind: 'pullDelta',
      pullDelta: { records: [], watermark: '1', more: false }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function unauthorized() {
  return new Response(
    JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'expired' } }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}

describe('401 handling', () => {
  it('retries once with the token onUnauthorized returns', async () => {
    const seenTokens: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>
        seenTokens.push(headers.Authorization ?? '')
        if (headers.Authorization === 'Bearer stale') return unauthorized()
        return pullDeltaResponse(JSON.parse(String(init?.body)))
      })
    )
    const onUnauthorized = vi.fn(async () => 'fresh')
    const client = createHttpSyncClient({
      apiUrl: 'https://api.example.com',
      getAccessToken: async () => 'stale',
      onUnauthorized
    })

    await expect(client.pull(crypto.randomUUID(), '0')).resolves.toMatchObject({
      more: false
    })

    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith('stale')
    expect(seenTokens).toEqual(['Bearer stale', 'Bearer fresh'])
  })

  it('surfaces the 401 when no new token is available', async () => {
    const fetchMock = vi.fn(async () => unauthorized())
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpSyncClient({
      apiUrl: 'https://api.example.com',
      getAccessToken: async () => 'stale',
      onUnauthorized: async () => null
    })

    await expect(client.pull(crypto.randomUUID(), '0')).rejects.toMatchObject<
      Partial<SyncHttpError>
    >({ status: 401 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('gives up after a single retry when the new token is rejected too', async () => {
    const fetchMock = vi.fn(async () => unauthorized())
    vi.stubGlobal('fetch', fetchMock)
    const onUnauthorized = vi.fn(async () => 'fresh')
    const client = createHttpSyncClient({
      apiUrl: 'https://api.example.com',
      getAccessToken: async () => 'stale',
      onUnauthorized
    })

    await expect(client.pull(crypto.randomUUID(), '0')).rejects.toMatchObject<
      Partial<SyncHttpError>
    >({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does not retry other errors', async () => {
    const onUnauthorized = vi.fn(async () => 'fresh')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 403 }))
    )
    const client = createHttpSyncClient({
      apiUrl: 'https://api.example.com',
      getAccessToken: async () => 'stale',
      onUnauthorized
    })

    await expect(client.pull(crypto.randomUUID(), '0')).rejects.toMatchObject({
      status: 403
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
