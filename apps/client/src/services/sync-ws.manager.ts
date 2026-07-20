import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  decodeFrame,
  encodeFrame,
  type Mutation,
  type PullDelta,
  type PushAck,
  type SyncEnvelope,
  type TopicConflictResolved
} from '@spaced-rep/sync-protocol'
import { ensureFreshSession } from '@/lib/api'
import { getWsUrl } from './sync-http.client'

export type WsConnectionState =
  'disconnected' | 'connecting' | 'authenticating' | 'active'

type WsListeners = {
  onDelta?: (delta: PullDelta) => void
  onPushAck?: (ack: PushAck) => void
  onConflict?: (conflict: TopicConflictResolved) => void
  onStateChange?: (state: WsConnectionState) => void
  onTokenExpired?: () => void
}

const HIGH_WATER_BYTES = 512 * 1024
const LOW_WATER_BYTES = 64 * 1024

export class SyncWsManager {
  private ws: WebSocket | null = null
  private state: WsConnectionState = 'disconnected'
  private deviceId = ''
  private lastPulledAt = new Date(0).toISOString()
  private pendingOpCount = 0
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private lastServerPingAt = Date.now()
  private intentionalClose = false
  private listeners: WsListeners = {}
  private pendingAcks = new Map<
    string,
    { resolve: (ack: PushAck) => void; reject: (err: Error) => void }
  >()

  setListeners(listeners: WsListeners): void {
    this.listeners = listeners
  }

  getState(): WsConnectionState {
    return this.state
  }

  isActive(): boolean {
    return this.state === 'active' && this.ws?.readyState === WebSocket.OPEN
  }

  async connect(input: {
    deviceId: string
    lastPulledAt: string
    pendingOpCount: number
  }): Promise<void> {
    this.deviceId = input.deviceId
    this.lastPulledAt = input.lastPulledAt
    this.pendingOpCount = input.pendingOpCount
    this.intentionalClose = false

    const wsUrl = getWsUrl()
    if (!wsUrl) return

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    const session = await ensureFreshSession()
    if (!session?.accessToken) {
      this.setState('disconnected')
      return
    }

    this.setState('connecting')

    // Browser WebSocket cannot set Authorization header — use subprotocol trick
    // is unreliable; pass token as first Hello after connect instead would leave
    // the socket unauthenticated. Use query for browsers; server also accepts header.
    const url = new URL(wsUrl)
    // ponytail: browsers can't set WS Authorization headers; token in query is
    // unavoidable. Prefer short-lived access tokens (already 15m TTL).
    url.searchParams.set('access_token', session.accessToken)

    const ws = new WebSocket(url.toString())
    ws.binaryType = 'arraybuffer'
    this.ws = ws

    ws.onopen = () => {
      this.setState('authenticating')
      this.send({
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        deviceId: this.deviceId,
        sentAt: Date.now(),
        kind: 'hello',
        hello: {
          lastPulledAt: this.lastPulledAt,
          pendingOpCount: this.pendingOpCount,
          protocolVersion: PROTOCOL_VERSION
        }
      })
      this.startPingWatch()
    }

    ws.onmessage = event => {
      void this.onMessage(event.data)
    }

    ws.onclose = event => {
      this.clearPingWatch()
      this.setState('disconnected')
      this.ws = null

      for (const [, pending] of this.pendingAcks) {
        pending.reject(new Error('WebSocket closed'))
      }
      this.pendingAcks.clear()

      if (event.code === 4001) {
        this.listeners.onTokenExpired?.()
      }

      if (!this.intentionalClose) {
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      // onclose will fire next
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.clearPingWatch()
    if (this.ws) {
      this.send({
        version: PROTOCOL_VERSION,
        messageId: createEnvelopeId(),
        deviceId: this.deviceId,
        sentAt: Date.now(),
        kind: 'gracefulClose',
        gracefulClose: { reason: 'client_logout' }
      })
      this.ws.close(1000, 'logout')
      this.ws = null
    }
    this.setState('disconnected')
  }

  updateResume(lastPulledAt: string, pendingOpCount: number): void {
    this.lastPulledAt = lastPulledAt
    this.pendingOpCount = pendingOpCount
  }

  async pushBatch(mutations: Mutation[]): Promise<PushAck> {
    if (!this.isActive() || !this.ws) {
      throw new Error('WebSocket not active')
    }

    await this.waitForBackpressure()

    const messageId = createEnvelopeId()
    const envelope: SyncEnvelope = {
      version: PROTOCOL_VERSION,
      messageId,
      deviceId: this.deviceId,
      sentAt: Date.now(),
      kind: 'pushBatch',
      pushBatch: { mutations }
    }

    return new Promise<PushAck>((resolve, reject) => {
      this.pendingAcks.set(messageId, { resolve, reject })
      this.send(envelope)
      setTimeout(() => {
        if (this.pendingAcks.has(messageId)) {
          this.pendingAcks.delete(messageId)
          reject(new Error('PushAck timeout'))
        }
      }, 30_000)
    })
  }

  private async waitForBackpressure(): Promise<void> {
    if (!this.ws) return
    while (this.ws.bufferedAmount > HIGH_WATER_BYTES) {
      await new Promise(r => setTimeout(r, 100))
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      if (this.ws.bufferedAmount < LOW_WATER_BYTES) return
    }
  }

  private send(envelope: SyncEnvelope): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(Uint8Array.from(encodeFrame(envelope)))
  }

  private async onMessage(data: ArrayBuffer | Blob): Promise<void> {
    const buffer =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(await data.arrayBuffer())

    let envelope: SyncEnvelope
    try {
      envelope = decodeFrame(buffer)
    } catch (err) {
      console.error('WS decode error:', err)
      return
    }

    switch (envelope.kind) {
      case 'helloAck':
        this.attempt = 0
        this.setState('active')
        break
      case 'pullDelta':
        this.listeners.onDelta?.(envelope.pullDelta)
        break
      case 'pushAck': {
        const corr = envelope.correlationId
        if (corr && this.pendingAcks.has(corr)) {
          this.pendingAcks.get(corr)!.resolve(envelope.pushAck)
          this.pendingAcks.delete(corr)
        }
        this.listeners.onPushAck?.(envelope.pushAck)
        break
      }
      case 'topicConflictResolved':
        this.listeners.onConflict?.(envelope.topicConflictResolved)
        break
      case 'ping':
        this.lastServerPingAt = Date.now()
        this.send({
          version: PROTOCOL_VERSION,
          messageId: createEnvelopeId(),
          correlationId: envelope.messageId,
          deviceId: this.deviceId,
          sentAt: Date.now(),
          kind: 'pong',
          pong: { timestamp: envelope.ping.timestamp }
        })
        break
      case 'pong':
        this.lastServerPingAt = Date.now()
        break
      case 'error':
        console.error('WS sync error:', envelope.error)
        if (envelope.error.code === 'TOKEN_EXPIRED') {
          this.listeners.onTokenExpired?.()
          this.ws?.close(4001, 'token expired')
        }
        break
      case 'gracefulClose':
        this.intentionalClose = false
        this.ws?.close(1001, envelope.gracefulClose.reason)
        break
      default:
        break
    }
  }

  private setState(state: WsConnectionState): void {
    this.state = state
    this.listeners.onStateChange?.(state)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delay =
      Math.min(30_000, 1000 * 2 ** this.attempt) + Math.random() * 1000
    this.attempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect({
        deviceId: this.deviceId,
        lastPulledAt: this.lastPulledAt,
        pendingOpCount: this.pendingOpCount
      })
    }, delay)
  }

  private startPingWatch(): void {
    this.clearPingWatch()
    this.lastServerPingAt = Date.now()
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastServerPingAt > 70_000) {
        this.ws?.close(1001, 'missed pings')
      }
    }, 10_000)
  }

  private clearPingWatch(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}

export const syncWsManager = new SyncWsManager()
