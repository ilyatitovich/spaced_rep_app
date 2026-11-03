import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/config/env.js', () => ({
  env: {
    CORS_ORIGIN: [
      'http://localhost:5173',
      'chrome-extension://allowlisted-extension-id'
    ],
    TURNSTILE_SECRET_KEY: 'test-secret'
  }
}))

const { verifyTurnstileToken } = await import('./turnstile.service.js')

describe('verifyTurnstileToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('skips bot checks for an allowlisted chrome-extension origin', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyTurnstileToken(
        'not-a-token',
        null,
        'chrome-extension://allowlisted-extension-id'
      )
    ).resolves.toBeUndefined()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not skip Turnstile for a non-allowlisted chrome-extension origin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          'success': false,
          'error-codes': ['invalid-input-response']
        })
      })
    )

    await expect(
      verifyTurnstileToken('not-a-token', null, 'chrome-extension://evil')
    ).rejects.toMatchObject({ code: 'TURNSTILE_FAILED' })
  })
})
