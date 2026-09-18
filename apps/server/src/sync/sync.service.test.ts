import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = {
  $executeRaw: vi.fn(),
  syncDevice: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn()
  }
}

vi.mock('../shared/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async callback => callback(tx)),
    syncDevice: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
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

const { listSyncDevices, reportDevice, revokeSyncDevice } =
  await import('./sync.service.js')
const { prisma } = await import('../shared/lib/prisma.js')

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

    expect(tx.$executeRaw).toHaveBeenCalledOnce()
    expect(tx.syncDevice.upsert).not.toHaveBeenCalled()
  })

  it('refreshes an existing device without consuming another slot', async () => {
    tx.syncDevice.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: null
    })
    tx.syncDevice.count.mockResolvedValue(3)

    await reportDevice({
      userId: 'user-1',
      deviceId: 'device-1',
      lastPulledAt: new Date(0).toISOString()
    })

    expect(tx.syncDevice.count).not.toHaveBeenCalled()
    expect(tx.syncDevice.upsert).toHaveBeenCalledOnce()
    expect(tx.syncDevice.upsert.mock.calls[0]?.[0].update).not.toHaveProperty(
      'userAgent'
    )
  })

  it('updates userAgent when provided on an existing device', async () => {
    tx.syncDevice.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: null
    })

    await reportDevice({
      userId: 'user-1',
      deviceId: 'device-1',
      userAgent: 'Mozilla/5.0 Firefox/121.0'
    })

    expect(tx.syncDevice.upsert.mock.calls[0]?.[0].update).toMatchObject({
      userAgent: 'Mozilla/5.0 Firefox/121.0'
    })
  })

  it('removes aged-out devices before counting a new registration', async () => {
    tx.syncDevice.count.mockResolvedValue(2)

    await reportDevice({
      userId: 'user-1',
      deviceId: 'device-4',
      lastPulledAt: new Date(0).toISOString()
    })

    expect(tx.syncDevice.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
        lastSeenAt: { lte: expect.any(Date) }
      }
    })
    expect(tx.syncDevice.upsert).toHaveBeenCalledOnce()
  })

  it('does not allow a revoked device to register itself again', async () => {
    tx.syncDevice.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: new Date()
    })

    await expect(
      reportDevice({
        userId: 'user-1',
        deviceId: 'device-1',
        lastPulledAt: new Date(0).toISOString()
      })
    ).rejects.toMatchObject({ code: 'DEVICE_REVOKED' })
  })

  it('lists active devices and revokes another device', async () => {
    vi.mocked(prisma.syncDevice.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.syncDevice.updateMany).mockResolvedValue({
      count: 1
    } as never)

    await expect(listSyncDevices('user-1')).resolves.toEqual([])
    await expect(
      revokeSyncDevice({
        userId: 'user-1',
        deviceId: 'device-2',
        currentDeviceId: 'device-1'
      })
    ).resolves.toEqual({ revoked: true })

    expect(prisma.syncDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null }
      })
    )
    expect(prisma.syncDevice.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'device-2',
        userId: 'user-1',
        revokedAt: null
      },
      data: { revokedAt: expect.any(Date) }
    })
  })

  it('protects the current device from accidental revocation', async () => {
    await expect(
      revokeSyncDevice({
        userId: 'user-1',
        deviceId: 'device-1',
        currentDeviceId: 'device-1'
      })
    ).rejects.toMatchObject({ code: 'CURRENT_DEVICE' })

    expect(prisma.syncDevice.updateMany).not.toHaveBeenCalled()
  })
})
