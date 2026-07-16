import type { Server as HttpServer, IncomingMessage } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  decodeFrame,
  encodeFrame,
  type SyncEnvelope
} from '@spaced-rep/sync-protocol'
import { verifyAccessToken } from '../auth/services/index.js'
import { prisma } from '../shared/lib/prisma.js'
import { logger } from '../shared/lib/logger.js'
import {
  applyPushBatch,
  pullChanges,
  reportDevice
} from './sync.service.js'
import {
  startFanoutSubscriber,
  subscribeFanout
} from './fanout.service.js'

type Conn = {
  ws: WebSocket
  userId: string
  deviceId: string
  sessionId: string
  lastPongAt: number
}

const connections = new Map<string, Conn>() // key: `${userId}:${deviceId}`

function connKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

function send(ws: WebSocket, envelope: SyncEnvelope): void {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(encodeFrame(envelope))
}

async function authenticateUpgrade(
  req: IncomingMessage
): Promise<{ userId: string; sessionId: string } | null> {
  let token: string | undefined

  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length).trim()
  }

  if (!token && req.url) {
    try {
      const url = new URL(req.url, 'http://localhost')
      token = url.searchParams.get('access_token') ?? undefined
    } catch {
      // ignore
    }
  }

  if (!token) return null

  try {
    const payload = await verifyAccessToken(token)
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: { id: true }
    })
    if (!session) return null
    return { userId: payload.userId, sessionId: payload.sessionId }
  } catch {
    return null
  }
}

async function handleMessage(conn: Conn, data: Buffer): Promise<void> {
  let envelope: SyncEnvelope
  try {
    envelope = decodeFrame(new Uint8Array(data))
  } catch (err) {
    send(conn.ws, {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      deviceId: conn.deviceId,
      sentAt: Date.now(),
      kind: 'error',
      error: {
        code: 'DECODE_ERROR',
        message: err instanceof Error ? err.message : 'Invalid frame',
        retryable: false
      }
    })
    return
  }

  switch (envelope.kind) {
    case 'hello': {
      if (envelope.hello.protocolVersion !== PROTOCOL_VERSION) {
        send(conn.ws, {
          version: PROTOCOL_VERSION,
          messageId: createEnvelopeId(),
          correlationId: envelope.messageId,
          deviceId: conn.deviceId,
          sentAt: Date.now(),
          kind: 'error',
          error: {
            code: 'PROTOCOL_MISMATCH',
            message: `Unsupported protocol version ${envelope.hello.protocolVersion}`,
            retryable: false
          }
        })
        conn.ws.close(4002, 'protocol mismatch')
        return
      }

      conn.deviceId = envelope.deviceId
      const key = connKey(conn.userId, conn.deviceId)
      const existing = connections.get(key)
      if (existing && existing.ws !== conn.ws) {
        existing.ws.close(1000, 'replaced')
      }
      connections.set(key, conn)

      await reportDevice({
        userId: conn.userId,
        deviceId: conn.deviceId,
        lastPulledAt: envelope.hello.lastPulledAt
      })

      send(conn.ws, {
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        correlationId: envelope.messageId,
        deviceId: conn.deviceId,
        sentAt: Date.now(),
        kind: 'helloAck',
        helloAck: {
          serverTime: Date.now(),
          missedSince: envelope.hello.lastPulledAt,
          sessionId: conn.sessionId
        }
      })

      const delta = await pullChanges({
        userId: conn.userId,
        since: envelope.hello.lastPulledAt
      })
      if (delta.records.length > 0) {
        send(conn.ws, {
          version: PROTOCOL_VERSION,
          messageId: createEnvelopeId(),
          deviceId: conn.deviceId,
          sentAt: Date.now(),
          kind: 'pullDelta',
          pullDelta: delta
        })
      }
      break
    }
    case 'pushBatch': {
      const ack = await applyPushBatch({
        userId: conn.userId,
        deviceId: conn.deviceId || envelope.deviceId,
        mutations: envelope.pushBatch.mutations
      })
      send(conn.ws, {
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        correlationId: envelope.messageId,
        deviceId: conn.deviceId,
        sentAt: Date.now(),
        kind: 'pushAck',
        pushAck: ack
      })
      break
    }
    case 'pullRequest': {
      const delta = await pullChanges({
        userId: conn.userId,
        since: envelope.pullRequest.since
      })
      send(conn.ws, {
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        correlationId: envelope.messageId,
        deviceId: conn.deviceId,
        sentAt: Date.now(),
        kind: 'pullDelta',
        pullDelta: delta
      })
      break
    }
    case 'ping': {
      send(conn.ws, {
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        correlationId: envelope.messageId,
        deviceId: conn.deviceId,
        sentAt: Date.now(),
        kind: 'pong',
        pong: { timestamp: envelope.ping.timestamp }
      })
      break
    }
    case 'pong': {
      conn.lastPongAt = Date.now()
      break
    }
    case 'gracefulClose': {
      conn.ws.close(1000, envelope.gracefulClose.reason)
      break
    }
    default:
      break
  }
}

export function createSyncWss(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/sync/ws',
    perMessageDeflate: true,
    maxPayload: 1024 * 1024
  })

  subscribeFanout((userId, envelope, excludeDeviceId) => {
    for (const conn of connections.values()) {
      if (conn.userId !== userId) continue
      if (excludeDeviceId && conn.deviceId === excludeDeviceId) continue
      send(conn.ws, envelope)
    }
  })

  void startFanoutSubscriber((userId, frame, excludeDeviceId) => {
    for (const conn of connections.values()) {
      if (conn.userId !== userId) continue
      if (excludeDeviceId && conn.deviceId === excludeDeviceId) continue
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(frame)
      }
    }
  })

  // Server → client ping every 30s
  const heartbeat = setInterval(() => {
    const now = Date.now()
    for (const [key, conn] of connections) {
      if (now - conn.lastPongAt > 70_000) {
        conn.ws.close(1001, 'heartbeat timeout')
        connections.delete(key)
        continue
      }
      send(conn.ws, {
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        deviceId: conn.deviceId,
        sentAt: now,
        kind: 'ping',
        ping: { timestamp: now }
      })
    }
  }, 30_000)
  heartbeat.unref()

  wss.on('connection', (ws, req) => {
    void (async () => {
      const auth = await authenticateUpgrade(req)
      if (!auth) {
        send(ws, {
          version: PROTOCOL_VERSION,
          messageId: createEnvelopeId(),
          deviceId: '',
          sentAt: Date.now(),
          kind: 'error',
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Unauthorized',
            retryable: true
          }
        })
        ws.close(4001, 'unauthorized')
        return
      }

      const conn: Conn = {
        ws,
        userId: auth.userId,
        deviceId: '',
        sessionId: auth.sessionId,
        lastPongAt: Date.now()
      }

      logger.info({ userId: auth.userId }, 'ws.connect')

      ws.on('message', data => {
        void handleMessage(conn, data as Buffer).catch(err => {
          logger.error({ err }, 'ws.message handler error')
        })
      })

      ws.on('close', () => {
        if (conn.deviceId) {
          connections.delete(connKey(conn.userId, conn.deviceId))
        }
        logger.info({ userId: conn.userId, deviceId: conn.deviceId }, 'ws.disconnect')
      })

      ws.on('error', err => {
        logger.error({ err, userId: conn.userId }, 'ws.error')
      })
    })()
  })

  wss.on('close', () => clearInterval(heartbeat))

  return wss
}

export function broadcastGracefulShutdown(reason: string): void {
  for (const conn of connections.values()) {
    send(conn.ws, {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      deviceId: conn.deviceId,
      sentAt: Date.now(),
      kind: 'gracefulClose',
      gracefulClose: { reason }
    })
    conn.ws.close(1001, reason)
  }
  connections.clear()
}
