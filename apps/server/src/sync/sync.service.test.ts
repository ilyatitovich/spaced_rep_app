import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = {
  $queryRaw: vi.fn(),
  syncDevice: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn()
  }
}

vi.mock('../shared/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async callback => callback(tx))
  }
}))

vi.mock('./conflict.service.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  countOtherActiveDevices: vi.fn(),
  purgeSyncedTombstones: vi.fn(),
  resolveTopicTitleConflict: vi.fn()
}))

vi.mock('./fanout.service.js', () => ({ publishFanout: vi.fn() }))
vi.mock('./idempotency.service.js', () => ({
  markOpApplied: vi.fn(),
  wasOpApplied: vi.fn()
}))

const { reportDevice } = await import('./sync.service.js')

describe('reportDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.syncDevice.findUnique.mockResolvedValue(null)
    tx.syncDevice.deleteMany.mockResolvedValue({ count: 0 })
    tx.syncDevice.upsert.mockResolvedValue({})
  })

  it('rejects a fourth active device inside the registration lock', async () => {
    tx.syncDevice.count.mockResolvedValue(3)

    await expect(
      reportDevice({
        userId: 'user-1',
        deviceId: 'device-4',
        lastPulledAt: new Date(0).toISOString()
      })
    ).rejects.toMatchObject({ code: 'DEVICE_LIMIT' })

    expect(tx.$queryRaw).toHaveBeenCalledOnce()
    expect(tx.syncDevice.upsert).not.toHaveBeenCalled()
  })
})
