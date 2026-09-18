import { createServer } from 'node:http'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  decodeEnvelope,
  encodeEnvelope
} from '@spaced-rep/sync-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessToken = vi.fn()
vi.mock('../auth/services/index.js', () => ({ verifyAccessToken }))

const prisma = {
  session: { findFirst: vi.fn() },
  subscription: { findMany: vi.fn() }
}
vi.mock('../shared/lib/prisma.js', () => ({ prisma }))
vi.mock('../shared/lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() }
}))

const assertPlan = vi.fn()
vi.mock('../settings/services/plan.service.js', () => ({
  assertPlan,
  isPlanEntitled: vi.fn()
}))

const reportDevice = vi.fn()
const pullChanges = vi.fn()
vi.mock('./sync.service.js', () => ({
  applyPushBatch: vi.fn(),
  pullChanges,
  reportDevice
}))
vi.mock('./fanout.service.js', () => ({
  startFanoutSubscriber: vi.fn().mockResolvedValue(undefined),
  subscribeFanout: vi.fn()
}))

const { createSyncWss, disconnectSyncDevice } = await import('./ws.handler.js')

describe('sync websocket entitlement', () => {
  const servers: Array<ReturnType<typeof createServer>> = []

  beforeEach(() => {
    vi.clearAllMocks()
    verifyAccessToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1'
    })
    prisma.session.findFirst.mockResolvedValue({ id: 'session-1' })
    assertPlan.mockResolvedValue(undefined)
    reportDevice.mockResolvedValue(undefined)
    pullChanges.mockResolvedValue({
      records: [],
      watermark: new Date(0).toISOString(),
      more: false
    })
  })

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map(
          server => new Promise<void>(resolve => server.close(() => resolve()))
        )
    )
  })

  it('closes an existing connection when entitlement is lost before pull', async () => {
    const server = createServer()
    servers.push(server)
    const wss = createSyncWss(server)
    server.listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No address')

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/sync/ws`, {
      headers: {
        Authorization: 'Bearer token',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) TestBrowser/1.0'
      }
    })
    await once(ws, 'open')
    await vi.waitFor(() => expect(assertPlan).toHaveBeenCalledOnce())

    ws.send(
      encodeEnvelope({
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        deviceId: '11111111-1111-4111-8111-111111111111',
        sentAt: Date.now(),
        kind: 'hello',
        hello: {
          lastPulledAt: new Date(0).toISOString(),
          pendingOpCount: 0,
          protocolVersion: PROTOCOL_VERSION
        }
      })
    )
    const [helloData] = await once(ws, 'message')
    expect(decodeEnvelope(helloData.toString()).kind).toBe('helloAck')
    expect(reportDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        deviceId: '11111111-1111-4111-8111-111111111111',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) TestBrowser/1.0'
      })
    )

    assertPlan.mockRejectedValueOnce(new Error('PLAN_REQUIRED'))
    ws.send(
      encodeEnvelope({
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        deviceId: '11111111-1111-4111-8111-111111111111',
        sentAt: Date.now(),
        kind: 'pullRequest',
        pullRequest: { since: new Date(0).toISOString() }
      })
    )

    const [errorData] = await once(ws, 'message')
    const response = decodeEnvelope(errorData.toString())
    expect(response.kind).toBe('error')
    if (response.kind === 'error') {
      expect(response.error.code).toBe('PLAN_REQUIRED')
    }
    const [code] = await once(ws, 'close')
    expect(code).toBe(4003)
    expect(pullChanges).toHaveBeenCalledOnce()

    wss.close()
  })

  it('rejects hello with PROTOCOL_MISMATCH and closes', async () => {
    const server = createServer()
    servers.push(server)
    const wss = createSyncWss(server)
    server.listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No address')

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/sync/ws`, {
      headers: { Authorization: 'Bearer token' }
    })
    await once(ws, 'open')
    await vi.waitFor(() => expect(assertPlan).toHaveBeenCalledOnce())

    ws.send(
      encodeEnvelope({
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        deviceId: '11111111-1111-4111-8111-111111111111',
        sentAt: Date.now(),
        kind: 'hello',
        hello: {
          lastPulledAt: new Date(0).toISOString(),
          pendingOpCount: 0,
          protocolVersion: 2
        }
      })
    )

    const [errorData] = await once(ws, 'message')
    const response = decodeEnvelope(errorData.toString())
    expect(response.kind).toBe('error')
    if (response.kind === 'error') {
      expect(response.error.code).toBe('PROTOCOL_MISMATCH')
      expect(response.error.retryable).toBe(false)
    }
    const [code] = await once(ws, 'close')
    expect(code).toBe(4002)
    expect(reportDevice).not.toHaveBeenCalled()

    wss.close()
  })

  it('closes a live connection when its device is revoked', async () => {
    const server = createServer()
    servers.push(server)
    const wss = createSyncWss(server)
    server.listen(0)
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No address')
    const deviceId = '11111111-1111-4111-8111-111111111111'

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/sync/ws`, {
      headers: { Authorization: 'Bearer token' }
    })
    await once(ws, 'open')
    await vi.waitFor(() => expect(assertPlan).toHaveBeenCalledOnce())
    ws.send(
      encodeEnvelope({
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        deviceId,
        sentAt: Date.now(),
        kind: 'hello',
        hello: {
          lastPulledAt: new Date(0).toISOString(),
          pendingOpCount: 0,
          protocolVersion: PROTOCOL_VERSION
        }
      })
    )
    await once(ws, 'message')

    disconnectSyncDevice('user-1', deviceId)

    const [errorData] = await once(ws, 'message')
    const response = decodeEnvelope(errorData.toString())
    expect(response.kind).toBe('error')
    if (response.kind === 'error') {
      expect(response.error.code).toBe('DEVICE_REVOKED')
    }
    const [code] = await once(ws, 'close')
    expect(code).toBe(4004)

    wss.close()
  })
})
