import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  session: { deleteMany: vi.fn() },
  refreshToken: { deleteMany: vi.fn() },
  securityEvent: { deleteMany: vi.fn() },
  billingEvent: { deleteMany: vi.fn() },
  billingCheckoutIntent: { deleteMany: vi.fn() }
}

vi.mock('../lib/prisma.js', () => ({ prisma }))
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() }
}))

const tryAcquireLeaderLock = vi.fn()
vi.mock('../lib/redis.js', () => ({ tryAcquireLeaderLock }))

const {
  runRetentionJob,
  RETENTION_SECURITY_EVENT_DAYS,
  RETENTION_BILLING_EVENT_DAYS,
  RETENTION_REVOKED_SESSION_DAYS
} = await import('./retention.service.js')

describe('runRetentionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tryAcquireLeaderLock.mockResolvedValue(true)
    prisma.session.deleteMany.mockResolvedValue({ count: 1 })
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 })
    prisma.securityEvent.deleteMany.mockResolvedValue({ count: 1 })
    prisma.billingEvent.deleteMany.mockResolvedValue({ count: 1 })
    prisma.billingCheckoutIntent.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('skips when the leader lock is not held', async () => {
    tryAcquireLeaderLock.mockResolvedValue(false)
    await runRetentionJob(new Date('2026-11-04T12:00:00.000Z'))
    expect(prisma.session.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes expired sessions, tokens, old events, and checkout intents', async () => {
    const now = new Date('2026-11-04T12:00:00.000Z')
    await runRetentionJob(now)

    expect(tryAcquireLeaderLock).toHaveBeenCalledWith(
      'leader:retention',
      25 * 60 * 60
    )

    const revokedBefore = new Date(
      now.getTime() - RETENTION_REVOKED_SESSION_DAYS * 86_400_000
    )
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: revokedBefore } }]
      }
    })
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } }
    })

    const securityBefore = new Date(
      now.getTime() - RETENTION_SECURITY_EVENT_DAYS * 86_400_000
    )
    expect(prisma.securityEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: securityBefore } }
    })

    const billingBefore = new Date(
      now.getTime() - RETENTION_BILLING_EVENT_DAYS * 86_400_000
    )
    expect(prisma.billingEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: billingBefore } }
    })
    expect(prisma.billingCheckoutIntent.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } }
    })
  })
})
