import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../../shared/lib/prisma.js', () => ({
  prisma: {
    userNotificationSettings: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('./push.service.js', () => ({
  sendPushToUser: vi.fn()
}))

vi.mock('../../settings/services/plan.service.js', () => ({
  assertPlan: vi.fn()
}))

vi.mock('../../emails/index.js', () => ({
  brand: { appName: 'TestApp' },
  renderNotificationEmailHtml: () => '<html></html>',
  renderNotificationEmailText: () => 'text'
}))

vi.mock('../../shared/config/env.js', () => ({
  env: {
    RESEND_API_KEY: 're_placeholder',
    EMAIL_FROM: 'test@example.com',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    VAPID_SUBJECT: 'mailto:test@example.com',
    VAPID_PUBLIC_KEY: 'pub',
    VAPID_PRIVATE_KEY: 'priv'
  }
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn() }
  }
}))

const { notifyUser } = await import('./notify.service.js')
const { prisma } = await import('../../shared/lib/prisma.js')
const { sendPushToUser } = await import('./push.service.js')
const { assertPlan } = await import('../../settings/services/plan.service.js')

describe('notifyUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips when notifications are disabled', async () => {
    vi.mocked(prisma.userNotificationSettings.findUnique).mockResolvedValue({
      enabled: false
    } as never)

    await notifyUser({
      userId: 'u1',
      type: 'study.reminder',
      title: 'Hi',
      body: 'Body',
      channels: ['PUSH', 'EMAIL']
    })

    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('sends push when enabled and channel is PUSH', async () => {
    vi.mocked(prisma.userNotificationSettings.findUnique).mockResolvedValue({
      enabled: true
    } as never)

    await notifyUser({
      userId: 'u1',
      type: 'study.reminder',
      title: 'Hi',
      body: 'Body',
      channels: ['PUSH']
    })

    expect(sendPushToUser).toHaveBeenCalledWith('u1', {
      title: 'Hi',
      body: 'Body',
      url: undefined,
      type: 'study.reminder'
    })
  })

  it('does not deliver without Pro entitlement', async () => {
    vi.mocked(assertPlan).mockRejectedValueOnce(new Error('PLAN_REQUIRED'))

    await expect(
      notifyUser({
        userId: 'u1',
        type: 'study.reminder',
        title: 'Hi',
        body: 'Body',
        channels: ['PUSH']
      })
    ).rejects.toThrow('PLAN_REQUIRED')

    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})
