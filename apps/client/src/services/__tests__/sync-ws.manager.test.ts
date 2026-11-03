import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PROTOCOL_VERSION,
  type Mutation,
  type PushAck
} from '@spaced-rep/sync-protocol'
import { FakeWebSocket, serverEnvelope } from './helpers/fake-ws'

const net = vi.hoisted(() => ({
  wsUrl: 'wss://api.test/sync/ws' as string | null,
  session: { accessToken: 'token-1' } as { accessToken: string } | null
}))

vi.mock('@/lib/api', () => ({
  ensureFreshSession: vi.fn(async () => net.session)
}))

vi.mock('../sync-http.client', () => ({
  getWsUrl: () => net.wsUrl
}))

const { SyncWsManager } = await import('../sync-ws.manager')

const RESUME = {
  deviceId: 'device-1',
  lastPulledAt: '2024-01-01T00:00:00.000Z',
  pendingOpCount: 3
}

const mutation: Mutation = {
  opId: 'op-1',
  deviceId: 'device-1',
  table: 'cards',
  recordId: 'card-1',
  operation: 'delete',
  updatedAt: 1_000
}

const ack = (acceptedOpIds: string[]): PushAck => ({
  acceptedOpIds,
  rejected: [],
  conflicts: []
})

function makeListeners() {
  return {
    onDelta: vi.fn(),
    onPushAck: vi.fn(),
    onConflict: vi.fn(),
    onStateChange: vi.fn(),
    onTokenExpired: vi.fn(),
    onPlanRequired: vi.fn(),
    onDeviceRevoked: vi.fn(),
    onProtocolMismatch: vi.fn()
  }
}

const helloAck = () =>
  serverEnvelope({
    kind: 'helloAck',
    helloAck: {
      serverTime: 1,
      missedSince: RESUME.lastPulledAt,
      sessionId: 's'
    }
  })

/** connect → server accepts → hello → helloAck. */
async function connectActive(
  manager: InstanceType<typeof SyncWsManager>
): Promise<FakeWebSocket> {
  await manager.connect(RESUME)
  const socket = FakeWebSocket.last()
  socket.open()
  socket.receive(helloAck())
  return socket
}

/** Settles to the rejection message (or 'resolved'), so fake timers can run first. */
function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    () => 'resolved',
    (error: Error) => error.message
  )
}

let manager: InstanceType<typeof SyncWsManager>
let listeners: ReturnType<typeof makeListeners>

beforeEach(() => {
  FakeWebSocket.reset()
  vi.stubGlobal('WebSocket', FakeWebSocket)
  net.wsUrl = 'wss://api.test/sync/ws'
  net.session = { accessToken: 'token-1' }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  manager = new SyncWsManager()
  listeners = makeListeners()
  manager.setListeners(listeners)
})

afterEach(() => {
  manager.disconnect()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('connect and handshake', () => {
  it('connects to the WS url with the access token, says hello with resume state, becomes active on helloAck', async () => {
    await manager.connect(RESUME)

    const socket = FakeWebSocket.last()
    const url = new URL(socket.url)
    expect(`${url.origin}${url.pathname}`).toBe('wss://api.test/sync/ws')
    expect(url.searchParams.get('access_token')).toBe('token-1')
    expect(manager.getState()).toBe('connecting')

    socket.open()
    expect(manager.getState()).toBe('authenticating')
    expect(socket.sentEnvelopes('hello')).toMatchObject([
      {
        deviceId: 'device-1',
        hello: {
          lastPulledAt: RESUME.lastPulledAt,
          pendingOpCount: 3,
          protocolVersion: PROTOCOL_VERSION
        }
      }
    ])
    expect(manager.isActive()).toBe(false)

    socket.receive(helloAck())
    expect(manager.isActive()).toBe(true)
    expect(listeners.onStateChange.mock.calls.map(([s]) => s)).toEqual([
      'connecting',
      'authenticating',
      'active'
    ])
  })

  it('does not open a socket without a WS URL', async () => {
    net.wsUrl = null
    await manager.connect(RESUME)
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(manager.getState()).toBe('disconnected')
  })

  it('stays disconnected and opens no socket when there is no session', async () => {
    net.session = null
    await manager.connect(RESUME)
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(manager.getState()).toBe('disconnected')
  })

  it('ignores connect while a socket is connecting or open', async () => {
    await manager.connect(RESUME)
    await manager.connect(RESUME)
    expect(FakeWebSocket.instances).toHaveLength(1)

    FakeWebSocket.last().open()
    await manager.connect(RESUME)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})

describe('inbound messages', () => {
  it('routes pullDelta, topicConflictResolved and pushAck to listeners', async () => {
    const socket = await connectActive(manager)
    const delta = {
      records: [],
      watermark: '2024-02-01T00:00:00.000Z',
      more: false
    }
    const conflict = {
      topicId: 't1',
      oldTitle: 'A',
      newTitle: 'A (2)',
      reason: 'duplicate',
      updatedAt: 5
    }

    socket.receive(serverEnvelope({ kind: 'pullDelta', pullDelta: delta }))
    socket.receive(
      serverEnvelope({
        kind: 'topicConflictResolved',
        topicConflictResolved: conflict
      })
    )
    socket.receive(serverEnvelope({ kind: 'pushAck', pushAck: ack(['x']) }))

    expect(listeners.onDelta).toHaveBeenCalledWith(delta)
    expect(listeners.onConflict).toHaveBeenCalledWith(conflict)
    expect(listeners.onPushAck).toHaveBeenCalledWith(ack(['x']))
  })

  it('survives non-text, non-JSON and schema-invalid frames', async () => {
    const socket = await connectActive(manager)

    socket.receiveRaw(new ArrayBuffer(8))
    socket.receiveRaw('not json')
    socket.receiveRaw(JSON.stringify({ kind: 'pullDelta' }))

    expect(console.error).toHaveBeenCalledTimes(3)
    expect(listeners.onDelta).not.toHaveBeenCalled()
    expect(manager.isActive()).toBe(true)
  })

  it('answers a server ping with a correlated pong', async () => {
    const socket = await connectActive(manager)

    socket.receive(
      serverEnvelope(
        { kind: 'ping', ping: { timestamp: 42 } },
        { messageId: 'ping-1' }
      )
    )

    expect(socket.sentEnvelopes('pong')).toMatchObject([
      { correlationId: 'ping-1', pong: { timestamp: 42 } }
    ])
  })
})

describe('pushBatch', () => {
  it('rejects when the socket is not active', async () => {
    await expect(manager.pushBatch([mutation])).rejects.toThrow(
      'WebSocket not active'
    )
  })

  it('sends the mutations and resolves with the ack correlated by messageId', async () => {
    const socket = await connectActive(manager)

    const result = manager.pushBatch([mutation])
    await vi.waitFor(() =>
      expect(socket.sentEnvelopes('pushBatch')).toHaveLength(1)
    )
    const sent = socket.sentEnvelopes('pushBatch')[0]
    expect(sent?.pushBatch.mutations).toEqual([mutation])

    socket.receive(
      serverEnvelope(
        { kind: 'pushAck', pushAck: ack(['op-1']) },
        { correlationId: sent?.messageId }
      )
    )

    await expect(result).resolves.toEqual(ack(['op-1']))
  })

  it('does not resolve on an ack for another message, but still notifies onPushAck', async () => {
    vi.useFakeTimers()
    const socket = await connectActive(manager)
    const result = manager.pushBatch([mutation])
    const settled = vi.fn()
    result.then(settled, settled)
    await vi.advanceTimersByTimeAsync(0)

    socket.receive(
      serverEnvelope(
        { kind: 'pushAck', pushAck: ack(['other']) },
        { correlationId: 'someone-else' }
      )
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(settled).not.toHaveBeenCalled()
    expect(listeners.onPushAck).toHaveBeenCalledOnce()

    // Let the dangling push time out so it doesn't leak past the test.
    const outcome = rejectionMessage(result)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await outcome).toBe('PushAck timeout')
  })

  it('rejects with a timeout when no ack arrives within 30s', async () => {
    vi.useFakeTimers()
    await connectActive(manager)

    const result = manager.pushBatch([mutation])
    const outcome = rejectionMessage(result)

    await vi.advanceTimersByTimeAsync(29_999)
    await vi.advanceTimersByTimeAsync(1)
    expect(await outcome).toBe('PushAck timeout')
  })

  it('rejects in-flight pushes when the socket closes', async () => {
    vi.useFakeTimers()
    const socket = await connectActive(manager)

    const result = manager.pushBatch([mutation])
    const outcome = rejectionMessage(result)
    await vi.advanceTimersByTimeAsync(0)
    socket.serverClose(1006)

    expect(await outcome).toBe('WebSocket closed')
  })

  it('rejects a push right away when the server answers it with an error', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const socket = await connectActive(manager)

    const result = manager.pushBatch([mutation])
    const outcome = rejectionMessage(result)
    await vi.advanceTimersByTimeAsync(0)
    const sent = socket.sentEnvelopes('pushBatch')[0]

    socket.receive(
      serverEnvelope(
        {
          kind: 'error',
          error: {
            code: 'RATE_LIMITED',
            message: 'Sync rate limit exceeded',
            retryable: true
          }
        },
        { correlationId: sent?.messageId }
      )
    )

    // No 30s wait: the caller falls back to HTTP immediately.
    expect(await outcome).toBe('RATE_LIMITED')
  })

  it('holds the send while the socket buffer is above the high-water mark', async () => {
    vi.useFakeTimers()
    const socket = await connectActive(manager)
    socket.bufferedAmount = 600 * 1024

    const result = manager.pushBatch([mutation])
    await vi.advanceTimersByTimeAsync(500)
    expect(socket.sentEnvelopes('pushBatch')).toHaveLength(0)

    socket.bufferedAmount = 0
    await vi.advanceTimersByTimeAsync(100)
    const sent = socket.sentEnvelopes('pushBatch')
    expect(sent).toHaveLength(1)

    socket.receive(
      serverEnvelope(
        { kind: 'pushAck', pushAck: ack(['op-1']) },
        { correlationId: sent[0]?.messageId }
      )
    )
    await expect(result).resolves.toEqual(ack(['op-1']))
  })
})

describe('close codes', () => {
  it.each([
    ['4001 token expired', 4001, '', 'onTokenExpired', true],
    ['4003 plan required', 4003, 'plan_required', 'onPlanRequired', false],
    ['4004 device revoked', 4004, 'device_revoked', 'onDeviceRevoked', false],
    ['4004 device limit', 4004, 'device_limit', 'onPlanRequired', false],
    ['1006 network drop', 1006, '', undefined, true]
  ] as const)(
    '%s -> listener %s, reconnect=%s',
    async (_name, code, reason, listener, reconnects) => {
      vi.useFakeTimers()
      const socket = await connectActive(manager)

      socket.serverClose(code, reason)
      await vi.advanceTimersByTimeAsync(60_000)

      const accessListeners = {
        onTokenExpired: listeners.onTokenExpired,
        onPlanRequired: listeners.onPlanRequired,
        onDeviceRevoked: listeners.onDeviceRevoked
      }
      for (const [name, fn] of Object.entries(accessListeners)) {
        if (name === listener) expect(fn).toHaveBeenCalled()
        else expect(fn).not.toHaveBeenCalled()
      }
      expect(manager.getState()).toBe(
        reconnects ? 'connecting' : 'disconnected'
      )
      expect(FakeWebSocket.instances).toHaveLength(reconnects ? 2 : 1)
    }
  )
})

describe('server error envelopes', () => {
  it.each([
    ['TOKEN_EXPIRED', 'onTokenExpired', 4001, true],
    ['DEVICE_REVOKED', 'onDeviceRevoked', 4004, false],
    ['PROTOCOL_MISMATCH', 'onProtocolMismatch', 4002, false],
    ['PLAN_REQUIRED', 'onPlanRequired', 4003, false],
    ['DEVICE_LIMIT', 'onPlanRequired', 4004, false]
  ] as const)(
    '%s -> %s, closes with %s, reconnect=%s',
    async (code, listener, closeCode, reconnects) => {
      vi.useFakeTimers()
      const socket = await connectActive(manager)

      socket.receive(
        serverEnvelope({
          kind: 'error',
          error: { code, message: code, retryable: false }
        })
      )
      await vi.advanceTimersByTimeAsync(60_000)

      expect(listeners[listener]).toHaveBeenCalled()
      expect(socket.closeCalls[0]?.code).toBe(closeCode)
      expect(FakeWebSocket.instances).toHaveLength(reconnects ? 2 : 1)
    }
  )

  it('an unrecognised error code is logged and leaves the socket open', async () => {
    const socket = await connectActive(manager)

    socket.receive(
      serverEnvelope({
        kind: 'error',
        error: { code: 'INTERNAL', message: 'boom', retryable: true }
      })
    )

    expect(socket.closeCalls).toHaveLength(0)
    expect(manager.isActive()).toBe(true)
    expect(listeners.onTokenExpired).not.toHaveBeenCalled()
    expect(listeners.onPlanRequired).not.toHaveBeenCalled()
  })

  it('a server gracefulClose closes the socket and reconnects', async () => {
    vi.useFakeTimers()
    const socket = await connectActive(manager)

    socket.receive(
      serverEnvelope({
        kind: 'gracefulClose',
        gracefulClose: { reason: 'deploy' }
      })
    )
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: 'deploy' }])

    await vi.advanceTimersByTimeAsync(2_000)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })
})

describe('reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  it('backs off exponentially, and a helloAck resets the backoff', async () => {
    const first = await connectActive(manager)

    first.serverClose(1006)
    await vi.advanceTimersByTimeAsync(999)
    expect(FakeWebSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(2)

    // Second attempt never reaches helloAck -> next delay doubles.
    FakeWebSocket.last().serverClose(1006)
    await vi.advanceTimersByTimeAsync(1_999)
    expect(FakeWebSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(3)

    // Handshake completes -> delay is back to the base.
    const third = FakeWebSocket.last()
    third.open()
    third.receive(helloAck())
    third.serverClose(1006)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(FakeWebSocket.instances).toHaveLength(4)
  })

  it('caps the delay at 30s', async () => {
    await manager.connect(RESUME)
    for (let i = 0; i < 8; i += 1) {
      FakeWebSocket.last().serverClose(1006)
      await vi.advanceTimersByTimeAsync(30_000)
    }
    const before = FakeWebSocket.instances.length

    FakeWebSocket.last().serverClose(1006)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(FakeWebSocket.instances).toHaveLength(before + 1)
  })

  it('re-says hello with the latest resume state from updateResume', async () => {
    const first = await connectActive(manager)
    manager.updateResume('2024-03-01T00:00:00.000Z', 0)

    first.serverClose(1006)
    await vi.advanceTimersByTimeAsync(1_000)
    const second = FakeWebSocket.last()
    second.open()

    expect(second.sentEnvelopes('hello')).toMatchObject([
      {
        deviceId: 'device-1',
        hello: { lastPulledAt: '2024-03-01T00:00:00.000Z', pendingOpCount: 0 }
      }
    ])
  })

  it('closes a socket that misses server pings for over 70s, and a ping keeps it alive', async () => {
    const socket = await connectActive(manager)

    await vi.advanceTimersByTimeAsync(60_000)
    socket.receive(serverEnvelope({ kind: 'ping', ping: { timestamp: 1 } }))
    await vi.advanceTimersByTimeAsync(70_000)
    expect(socket.closeCalls).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: 'missed pings' }])
  })
})

describe('disconnect', () => {
  it('says gracefulClose, closes with 1000 and does not reconnect', async () => {
    vi.useFakeTimers()
    const socket = await connectActive(manager)

    manager.disconnect()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(socket.sentEnvelopes('gracefulClose')).toMatchObject([
      { gracefulClose: { reason: 'client_logout' } }
    ])
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: 'logout' }])
    expect(manager.getState()).toBe('disconnected')
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('cancels a pending reconnect', async () => {
    vi.useFakeTimers()
    const socket = await connectActive(manager)
    socket.serverClose(1006)

    manager.disconnect()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
