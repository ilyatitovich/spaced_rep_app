import { describe, expect, it, vi } from 'vitest'

const prisma = {
  subscription: { findUniqueOrThrow: vi.fn() }
}
vi.mock('../../shared/lib/prisma.js', () => ({ prisma }))
vi.mock('./ensure.service.js', () => ({ ensureUserSettings: vi.fn() }))

const { assertPlan } = await import('./plan.service.js')

describe('assertPlan account state', () => {
  it('blocks a disabled account even with an active Pro subscription', async () => {
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      plan: 'PRO',
      status: 'ACTIVE',
      endsAt: null,
      user: { disabledAt: new Date() }
    })

    await expect(assertPlan('user-1', 'PRO')).rejects.toMatchObject({
      code: 'PLAN_REQUIRED'
    })
  })
})
