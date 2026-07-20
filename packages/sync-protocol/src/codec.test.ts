import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  decodeEnvelope,
  decodeFrame,
  encodeEnvelope,
  encodeFrame,
  type SyncEnvelope
} from './index.js'

describe('sync-protocol codec', () => {
  it('round-trips a hello envelope', () => {
    const envelope: SyncEnvelope = {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      deviceId: createEnvelopeId(),
      sentAt: Date.now(),
      kind: 'hello',
      hello: {
        lastPulledAt: new Date(0).toISOString(),
        pendingOpCount: 3,
        protocolVersion: PROTOCOL_VERSION
      }
    }

    const bytes = encodeEnvelope(envelope)
    const decoded = decodeEnvelope(bytes)

    expect(decoded.kind).toBe('hello')
    if (decoded.kind === 'hello') {
      expect(decoded.hello.pendingOpCount).toBe(3)
      expect(decoded.hello.protocolVersion).toBe(PROTOCOL_VERSION)
    }
  })

  it('round-trips a push batch with topic mutation', () => {
    const envelope: SyncEnvelope = {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      deviceId: 'device-1',
      sentAt: 1_700_000_000_000,
      kind: 'pushBatch',
      pushBatch: {
        mutations: [
          {
            opId: 'op-1',
            deviceId: 'device-1',
            table: 'topics',
            recordId: 'topic-1',
            operation: 'upsert',
            updatedAt: 1_700_000_000_000,
            topic: {
              id: 'topic-1',
              title: 'English',
              pivot: 1_700_000_000_000,
              weekJson: '[]',
              nextUpdateDate: 1_700_100_000_000,
              updatedAt: 1_700_000_000_000,
              deletedAt: null
            }
          }
        ]
      }
    }

    const decoded = decodeEnvelope(encodeEnvelope(envelope))
    expect(decoded.kind).toBe('pushBatch')
    if (decoded.kind === 'pushBatch') {
      expect(decoded.pushBatch.mutations).toHaveLength(1)
      expect(decoded.pushBatch.mutations[0]?.topic?.title).toBe('English')
      expect(decoded.pushBatch.mutations[0]?.table).toBe('topics')
      expect(decoded.pushBatch.mutations[0]?.operation).toBe('upsert')
    }
  })

  it('round-trips framed envelopes', () => {
    const envelope: SyncEnvelope = {
      version: PROTOCOL_VERSION,
      messageId: 'msg-1',
      deviceId: 'dev-1',
      sentAt: 42,
      kind: 'ping',
      ping: { timestamp: 42 }
    }
    const frame = encodeFrame(envelope)
    expect(frame[0]).toBe(0x53)
    const decoded = decodeFrame(frame)
    expect(decoded.kind).toBe('ping')
  })

  it('round-trips pull delta with card', () => {
    const envelope: SyncEnvelope = {
      version: PROTOCOL_VERSION,
      messageId: 'm',
      deviceId: 'd',
      sentAt: 1,
      kind: 'pullDelta',
      pullDelta: {
        watermark: '2024-01-01T00:00:00.000Z',
        more: false,
        records: [
          {
            card: {
              id: 'c1',
              topicId: 't1',
              level: 2,
              dataJson: '{"front":{},"back":{}}',
              updatedAt: 100,
              reviewDate: null,
              deletedAt: null
            }
          }
        ]
      }
    }
    const decoded = decodeEnvelope(encodeEnvelope(envelope))
    expect(decoded.kind).toBe('pullDelta')
    if (decoded.kind === 'pullDelta') {
      expect(decoded.pullDelta.records[0]?.card?.level).toBe(2)
    }
  })
})
