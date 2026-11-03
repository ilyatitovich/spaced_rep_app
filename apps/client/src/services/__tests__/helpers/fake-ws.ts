/**
 * Scriptable WebSocket stand-in. The test plays the server: `open()`,
 * `receive(...)`, `serverClose(...)`. Everything the client sends lands in `sent`.
 *
 *   vi.stubGlobal('WebSocket', FakeWebSocket)
 */
import { PROTOCOL_VERSION, type SyncEnvelope } from '@spaced-rep/sync-protocol'

type CloseListener = (event: { code: number; reason: string }) => void

export class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  static reset(): void {
    FakeWebSocket.instances = []
  }

  static last(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1)
    if (!socket) throw new Error('No FakeWebSocket was created')
    return socket
  }

  readyState: number = FakeWebSocket.CONNECTING
  bufferedAmount = 0
  sent: string[] = []
  closeCalls: { code?: number; reason?: string }[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: CloseListener | null = null
  onerror: (() => void) | null = null

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  /** Client-initiated close. */
  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason })
    this.finishClose(code ?? 1005, reason ?? '')
  }

  /** Server accepts the connection. */
  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  /** Server sends a raw frame. */
  receiveRaw(data: unknown): void {
    this.onmessage?.({ data })
  }

  receive(envelope: SyncEnvelope): void {
    this.receiveRaw(JSON.stringify(envelope))
  }

  /** Server/network drops the socket. */
  serverClose(code: number, reason = ''): void {
    this.finishClose(code, reason)
  }

  /** Decoded envelopes the client sent with the given `kind`. */
  sentEnvelopes<K extends SyncEnvelope['kind']>(
    kind: K
  ): Extract<SyncEnvelope, { kind: K }>[] {
    const all = this.sent.map(raw => JSON.parse(raw) as SyncEnvelope)
    return all.filter(
      (envelope): envelope is Extract<SyncEnvelope, { kind: K }> =>
        envelope.kind === kind
    )
  }

  private finishClose(code: number, reason: string): void {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }
}

type ServerPayload =
  | {
      kind: 'helloAck'
      helloAck: Extract<SyncEnvelope, { kind: 'helloAck' }>['helloAck']
    }
  | {
      kind: 'pullDelta'
      pullDelta: Extract<SyncEnvelope, { kind: 'pullDelta' }>['pullDelta']
    }
  | {
      kind: 'pushAck'
      pushAck: Extract<SyncEnvelope, { kind: 'pushAck' }>['pushAck']
    }
  | {
      kind: 'topicConflictResolved'
      topicConflictResolved: Extract<
        SyncEnvelope,
        { kind: 'topicConflictResolved' }
      >['topicConflictResolved']
    }
  | { kind: 'ping'; ping: Extract<SyncEnvelope, { kind: 'ping' }>['ping'] }
  | { kind: 'error'; error: Extract<SyncEnvelope, { kind: 'error' }>['error'] }
  | {
      kind: 'gracefulClose'
      gracefulClose: Extract<
        SyncEnvelope,
        { kind: 'gracefulClose' }
      >['gracefulClose']
    }

/** Server → client envelope with valid metadata. */
export function serverEnvelope(
  payload: ServerPayload,
  meta: { messageId?: string; correlationId?: string } = {}
): SyncEnvelope {
  return {
    version: PROTOCOL_VERSION,
    messageId: meta.messageId ?? crypto.randomUUID(),
    deviceId: 'server',
    sentAt: Date.now(),
    ...(meta.correlationId ? { correlationId: meta.correlationId } : {}),
    ...payload
  } as SyncEnvelope
}
