import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const deleteUser = vi.fn()
const cancelLemonSubscription = vi.fn()

vi.mock('../../shared/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique,
      delete: deleteUser
    }
  }
}))

vi.mock('../../shared/lib/r2-storage.js', () => ({
  isR2Configured: () => false,
  createR2StorageFromEnv: vi.fn()
}))

vi.mock('../../settings/billing/lemon-squeezy.js', () => ({
  cancelLemonSubscription
}))

const {
  deleteAccount,
  setAccountMediaStorageForTests,
  setAccountBillingCancelForTests
} = await import('./account.service.js')

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAccountMediaStorageForTests(null)
    setAccountBillingCancelForTests(null)
  })

  it('cancels Lemon, deletes R2 prefix, then deletes the DB user — in that order', async () => {
    const order: string[] = []
    findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { providerSubscriptionId: 'sub_abc' }
    })
    cancelLemonSubscription.mockImplementation(async () => {
      order.push('lemon')
    })
    const deletePrefix = vi.fn(async () => {
      order.push('r2')
    })
    setAccountMediaStorageForTests({ deletePrefix } as never)
    deleteUser.mockImplementation(async () => {
      order.push('db')
      return { id: 'user-1' }
    })

    await deleteAccount('user-1')

    expect(cancelLemonSubscription).toHaveBeenCalledWith('sub_abc')
    expect(deletePrefix).toHaveBeenCalledWith('user-1/')
    expect(deleteUser).toHaveBeenCalledWith({ where: { id: 'user-1' } })
    expect(order).toEqual(['lemon', 'r2', 'db'])
  })

  it('skips Lemon cancel when there is no provider subscription', async () => {
    findUnique.mockResolvedValue({
      id: 'user-2',
      subscription: null
    })
    const deletePrefix = vi.fn(async () => undefined)
    setAccountMediaStorageForTests({ deletePrefix } as never)
    deleteUser.mockResolvedValue({ id: 'user-2' })

    await deleteAccount('user-2')

    expect(cancelLemonSubscription).not.toHaveBeenCalled()
    expect(deletePrefix).toHaveBeenCalled()
    expect(deleteUser).toHaveBeenCalled()
  })

  it('continues deletion when Lemon cancel fails', async () => {
    findUnique.mockResolvedValue({
      id: 'user-3',
      subscription: { providerSubscriptionId: 'sub_gone' }
    })
    cancelLemonSubscription.mockRejectedValue(new Error('already cancelled'))
    const deletePrefix = vi.fn(async () => undefined)
    setAccountMediaStorageForTests({ deletePrefix } as never)
    deleteUser.mockResolvedValue({ id: 'user-3' })

    await deleteAccount('user-3')

    expect(deletePrefix).toHaveBeenCalled()
    expect(deleteUser).toHaveBeenCalled()
  })
})
