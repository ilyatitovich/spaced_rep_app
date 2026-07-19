import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

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

    assert.equal(decoded.kind, 'hello')
    if (decoded.kind === 'hello') {
      assert.equal(decoded.hello.pendingOpCount, 3)
      assert.equal(decoded.hello.protocolVersion, PROTOCOL_VERSION)
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
    assert.equal(decoded.kind, 'pushBatch')
    if (decoded.kind === 'pushBatch') {
      assert.equal(decoded.pushBatch.mutations.length, 1)
      assert.equal(decoded.pushBatch.mutations[0]?.topic?.title, 'English')
      assert.equal(decoded.pushBatch.mutations[0]?.table, 'topics')
      assert.equal(decoded.pushBatch.mutations[0]?.operation, 'upsert')
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
    assert.equal(frame[0], 0x53)
    const decoded = decodeFrame(frame)
    assert.equal(decoded.kind, 'ping')
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
    assert.equal(decoded.kind, 'pullDelta')
    if (decoded.kind === 'pullDelta') {
      assert.equal(decoded.pullDelta.records[0]?.card?.level, 2)
    }
  })
})
