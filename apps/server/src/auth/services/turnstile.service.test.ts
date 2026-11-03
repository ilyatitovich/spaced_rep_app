import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/config/env.js', () => ({
  env: { TURNSTILE_SECRET_KEY: 'test-secret' }
}))

const { verifyTurnstileToken } = await import('./turnstile.service.js')

describe('verifyTurnstileToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('accepts a token Cloudflare confirms', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyTurnstileToken('good-token', '203.0.113.9')
    ).resolves.toBeUndefined()

    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams
    expect(body.get('response')).toBe('good-token')
    expect(body.get('remoteip')).toBe('203.0.113.9')
  })

  it('rejects a token Cloudflare refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          'success': false,
          'error-codes': ['invalid-input-response']
        })
      })
    )

    await expect(verifyTurnstileToken('not-a-token')).rejects.toMatchObject({
      code: 'TURNSTILE_FAILED'
    })
  })

  it('bounds the Cloudflare call with a timeout signal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await verifyTurnstileToken('good-token')

    expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal)
  })

  it('fails closed when the Cloudflare call is aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    )

    await expect(verifyTurnstileToken('good-token')).rejects.toMatchObject({
      code: 'TURNSTILE_FAILED'
    })
  })
})
