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
