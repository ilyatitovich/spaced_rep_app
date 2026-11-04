import { beforeEach, describe, expect, it, vi } from 'vitest'

const enforceRateLimit = vi.fn()
const parseBody = vi.fn()
const rotateRefreshToken = vi.fn()
const exchangeGoogleCode = vi.fn()
const createSessionWithTokens = vi.fn()
const deleteAccount = vi.fn()
const sendData = vi.fn()

vi.mock('../../shared/lib/redis.js', () => ({ enforceRateLimit }))
vi.mock('../../shared/lib/http.js', () => ({
  parseBody,
  sendData
}))
vi.mock('../services/index.js', () => ({
  rotateRefreshToken,
  revokeSession: vi.fn(),
  exchangeGoogleCode,
  createSessionWithTokens,
  sendWelcomeEmail: vi.fn()
}))
vi.mock('../services/account.service.js', () => ({ deleteAccount }))

const { refreshTokenHandler } = await import('./token.handler.js')
const { googleCallbackHandler } = await import('./google.handler.js')
const { deleteAccountHandler } = await import('./account.handler.js')

describe('auth endpoint rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue(undefined)
  })

  it('rate-limits refresh by IP before rotating the token', async () => {
    parseBody.mockReturnValue({ refreshToken: 'rt' })
    rotateRefreshToken.mockResolvedValue({ accessToken: 'a' })
    const next = vi.fn()

    await refreshTokenHandler(
      { ip: '203.0.113.1', body: {}, get: () => undefined } as never,
      {} as never,
      next
    )

    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'auth:refresh:203.0.113.1',
        limit: 60,
        windowSeconds: 60
      })
    )
    expect(rotateRefreshToken).toHaveBeenCalled()
  })

  it('rate-limits Google callback by IP before exchanging the code', async () => {
    parseBody.mockReturnValue({
      code: 'c',
      codeVerifier: 'v',
      redirectUri: 'r'
    })
    exchangeGoogleCode.mockRejectedValue(new Error('stop-after-rate-limit'))
    const next = vi.fn()

    await googleCallbackHandler(
      { ip: '203.0.113.2', body: {}, get: () => undefined } as never,
      {} as never,
      next
    )

    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'auth:google:203.0.113.2',
        limit: 20,
        windowSeconds: 60
      })
    )
    expect(exchangeGoogleCode).toHaveBeenCalled()
  })

  it('rate-limits account deletion by userId before deleting', async () => {
    deleteAccount.mockResolvedValue(undefined)
    const res = { status: vi.fn(() => res), end: vi.fn() }
    const next = vi.fn()

    await deleteAccountHandler(
      { auth: { userId: 'user-del-1' }, ip: '203.0.113.3' } as never,
      res as never,
      next
    )

    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'auth:delete:user-del-1',
        limit: 5,
        windowSeconds: 3600
      })
    )
    expect(deleteAccount).toHaveBeenCalledWith('user-del-1')
  })
})
