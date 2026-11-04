import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = { $queryRaw: vi.fn() }
const redis = { isOpen: true, connect: vi.fn(), ping: vi.fn() }

vi.mock('./prisma.js', () => ({ prisma }))
vi.mock('./redis.js', () => ({ getRedis: () => redis }))

const { checkLiveness, checkReadiness } = await import('./health.js')

describe('checkLiveness', () => {
  it('reports ok without touching postgres or redis', async () => {
    const status = await checkLiveness()

    expect(status).toEqual({ status: 'ok' })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(redis.ping).not.toHaveBeenCalled()
  })
})

describe('checkReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redis.isOpen = true
    redis.ping.mockResolvedValue('PONG')
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  it('reports ok when postgres and redis answer', async () => {
    await expect(checkReadiness()).resolves.toEqual({
      status: 'ok',
      postgres: 'up',
      redis: 'up'
    })
  })

  it('reports unhealthy when postgres is down', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'))

    await expect(checkReadiness()).resolves.toEqual({
      status: 'unhealthy',
      postgres: 'down',
      redis: 'up'
    })
  })

  it('reports unhealthy when redis is down', async () => {
    redis.ping.mockRejectedValueOnce(new Error('connection refused'))

    await expect(checkReadiness()).resolves.toEqual({
      status: 'unhealthy',
      postgres: 'up',
      redis: 'down'
    })
  })
})
