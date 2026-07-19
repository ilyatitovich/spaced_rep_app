import protobuf from 'protobufjs'

/**
 * protobufjs JSON descriptor matching proto/sync/v1/sync.proto.
 * Wire format is Protocol Buffers proto3.
 */
const root = protobuf.Root.fromJSON({
  nested: {
    sync: {
      nested: {
        v1: {
          nested: {
            SyncTable: {
              values: {
                SYNC_TABLE_UNSPECIFIED: 0,
                SYNC_TABLE_TOPICS: 1,
                SYNC_TABLE_CARDS: 2
              }
            },
            SyncOperation: {
              values: {
                SYNC_OPERATION_UNSPECIFIED: 0,
                SYNC_OPERATION_UPSERT: 1,
                SYNC_OPERATION_DELETE: 2
              }
            },
            TopicRecord: {
              fields: {
                id: { type: 'string', id: 1 },
                title: { type: 'string', id: 2 },
                pivot: { type: 'int64', id: 3 },
                weekJson: { type: 'string', id: 4 },
                nextUpdateDate: { type: 'int64', id: 5 },
                updatedAt: { type: 'int64', id: 6 },
                deletedAt: { type: 'int64', id: 7 }
              }
            },
            CardRecord: {
              fields: {
                id: { type: 'string', id: 1 },
                topicId: { type: 'string', id: 2 },
                level: { type: 'int32', id: 3 },
                dataJson: { type: 'string', id: 4 },
                reviewDate: { type: 'int64', id: 5 },
                updatedAt: { type: 'int64', id: 6 },
                deletedAt: { type: 'int64', id: 7 }
              }
            },
            Mutation: {
              oneofs: {
                payload: { oneof: ['topic', 'card'] }
              },
              fields: {
                opId: { type: 'string', id: 1 },
                deviceId: { type: 'string', id: 2 },
                table: { type: 'SyncTable', id: 3 },
                recordId: { type: 'string', id: 4 },
                operation: { type: 'SyncOperation', id: 5 },
                updatedAt: { type: 'int64', id: 6 },
                topic: { type: 'TopicRecord', id: 7 },
                card: { type: 'CardRecord', id: 8 }
              }
            },
            SyncRecord: {
              oneofs: {
                record: { oneof: ['topic', 'card'] }
              },
              fields: {
                topic: { type: 'TopicRecord', id: 1 },
                card: { type: 'CardRecord', id: 2 }
              }
            },
            Hello: {
              fields: {
                lastPulledAt: { type: 'string', id: 1 },
                pendingOpCount: { type: 'uint32', id: 2 },
                protocolVersion: { type: 'uint32', id: 3 }
              }
            },
            HelloAck: {
              fields: {
                serverTime: { type: 'int64', id: 1 },
                missedSince: { type: 'string', id: 2 },
                sessionId: { type: 'string', id: 3 }
              }
            },
            PushBatch: {
              fields: {
                mutations: { rule: 'repeated', type: 'Mutation', id: 1 }
              }
            },
            RejectedOp: {
              fields: {
                opId: { type: 'string', id: 1 },
                code: { type: 'string', id: 2 },
                message: { type: 'string', id: 3 },
                retryable: { type: 'bool', id: 4 }
              }
            },
            TopicConflictResolved: {
              fields: {
                topicId: { type: 'string', id: 1 },
                oldTitle: { type: 'string', id: 2 },
                newTitle: { type: 'string', id: 3 },
                reason: { type: 'string', id: 4 },
                updatedAt: { type: 'int64', id: 5 }
              }
            },
            PushAck: {
              fields: {
                acceptedOpIds: {
                  rule: 'repeated',
                  type: 'string',
                  id: 1
                },
                rejected: { rule: 'repeated', type: 'RejectedOp', id: 2 },
                conflicts: {
                  rule: 'repeated',
                  type: 'TopicConflictResolved',
                  id: 3
                }
              }
            },
            PullDelta: {
              fields: {
                records: { rule: 'repeated', type: 'SyncRecord', id: 1 },
                watermark: { type: 'string', id: 2 },
                more: { type: 'bool', id: 3 }
              }
            },
            PullRequest: {
              fields: {
                since: { type: 'string', id: 1 }
              }
            },
            Ping: {
              fields: {
                timestamp: { type: 'int64', id: 1 }
              }
            },
            Pong: {
              fields: {
                timestamp: { type: 'int64', id: 1 }
              }
            },
            Error: {
              fields: {
                code: { type: 'string', id: 1 },
                message: { type: 'string', id: 2 },
                retryable: { type: 'bool', id: 3 }
              }
            },
            GracefulClose: {
              fields: {
                reason: { type: 'string', id: 1 }
              }
            },
            SyncEnvelope: {
              oneofs: {
                payload: {
                  oneof: [
                    'hello',
                    'helloAck',
                    'pushBatch',
                    'pushAck',
                    'pullDelta',
                    'pullRequest',
                    'topicConflictResolved',
                    'ping',
                    'pong',
                    'error',
                    'gracefulClose'
                  ]
                }
              },
              fields: {
                version: { type: 'uint32', id: 1 },
                messageId: { type: 'string', id: 2 },
                correlationId: { type: 'string', id: 3 },
                deviceId: { type: 'string', id: 4 },
                sentAt: { type: 'int64', id: 5 },
                traceId: { type: 'string', id: 6 },
                hello: { type: 'Hello', id: 10 },
                helloAck: { type: 'HelloAck', id: 11 },
                pushBatch: { type: 'PushBatch', id: 12 },
                pushAck: { type: 'PushAck', id: 13 },
                pullDelta: { type: 'PullDelta', id: 14 },
                pullRequest: { type: 'PullRequest', id: 15 },
                topicConflictResolved: {
                  type: 'TopicConflictResolved',
                  id: 16
                },
                ping: { type: 'Ping', id: 17 },
                pong: { type: 'Pong', id: 18 },
                error: { type: 'Error', id: 19 },
                gracefulClose: { type: 'GracefulClose', id: 20 }
              }
            }
          }
        }
      }
    }
  }
} as protobuf.INamespace)

export const SyncEnvelopeType = root.lookupType('sync.v1.SyncEnvelope')

const TABLE_TO_PROTO: Record<string, number> = {
  topics: 1,
  cards: 2
}

const PROTO_TO_TABLE: Record<number, 'topics' | 'cards'> = {
  1: 'topics',
  2: 'cards'
}

const OP_TO_PROTO: Record<string, number> = {
  upsert: 1,
  delete: 2
}

const PROTO_TO_OP: Record<number, 'upsert' | 'delete'> = {
  1: 'upsert',
  2: 'delete'
}

function longToNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  if (
    value &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value ?? 0)
}

function encodeTopic(t: {
  id: string
  title: string
  pivot: number
  weekJson: string
  nextUpdateDate: number
  updatedAt: number
  deletedAt?: number | null
}) {
  return {
    id: t.id,
    title: t.title,
    pivot: t.pivot,
    weekJson: t.weekJson,
    nextUpdateDate: t.nextUpdateDate,
    updatedAt: t.updatedAt,
    ...(t.deletedAt != null ? { deletedAt: t.deletedAt } : {})
  }
}

function decodeTopic(raw: Record<string, unknown>) {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    pivot: longToNumber(raw.pivot),
    weekJson: String(raw.weekJson ?? '[]'),
    nextUpdateDate: longToNumber(raw.nextUpdateDate),
    updatedAt: longToNumber(raw.updatedAt),
    deletedAt:
      raw.deletedAt === undefined || raw.deletedAt === null
        ? null
        : longToNumber(raw.deletedAt)
  }
}

function encodeCard(c: {
  id: string
  topicId: string
  level: number
  dataJson: string
  reviewDate?: number | null
  updatedAt: number
  deletedAt?: number | null
}) {
  return {
    id: c.id,
    topicId: c.topicId,
    level: c.level,
    dataJson: c.dataJson,
    updatedAt: c.updatedAt,
    ...(c.reviewDate != null ? { reviewDate: c.reviewDate } : {}),
    ...(c.deletedAt != null ? { deletedAt: c.deletedAt } : {})
  }
}

function decodeCard(raw: Record<string, unknown>) {
  return {
    id: String(raw.id ?? ''),
    topicId: String(raw.topicId ?? ''),
    level: Number(raw.level ?? 0),
    dataJson: String(raw.dataJson ?? '{}'),
    reviewDate:
      raw.reviewDate === undefined || raw.reviewDate === null
        ? null
        : longToNumber(raw.reviewDate),
    updatedAt: longToNumber(raw.updatedAt),
    deletedAt:
      raw.deletedAt === undefined || raw.deletedAt === null
        ? null
        : longToNumber(raw.deletedAt)
  }
}

import type {
  Mutation,
  SyncEnvelope,
  SyncEnvelopePayload,
  SyncRecord,
  TopicConflictResolved
} from './types.js'

function encodeMutation(m: Mutation) {
  return {
    opId: m.opId,
    deviceId: m.deviceId,
    table: TABLE_TO_PROTO[m.table] ?? 0,
    recordId: m.recordId,
    operation: OP_TO_PROTO[m.operation] ?? 0,
    updatedAt: m.updatedAt,
    ...(m.topic ? { topic: encodeTopic(m.topic) } : {}),
    ...(m.card ? { card: encodeCard(m.card) } : {})
  }
}

function decodeMutation(raw: Record<string, unknown>): Mutation {
  const tableNum = Number(raw.table ?? 0)
  const opNum = Number(raw.operation ?? 0)
  return {
    opId: String(raw.opId ?? ''),
    deviceId: String(raw.deviceId ?? ''),
    table: PROTO_TO_TABLE[tableNum] ?? 'topics',
    recordId: String(raw.recordId ?? ''),
    operation: PROTO_TO_OP[opNum] ?? 'upsert',
    updatedAt: longToNumber(raw.updatedAt),
    ...(raw.topic
      ? { topic: decodeTopic(raw.topic as Record<string, unknown>) }
      : {}),
    ...(raw.card
      ? { card: decodeCard(raw.card as Record<string, unknown>) }
      : {})
  }
}

function encodeRecord(r: SyncRecord) {
  return {
    ...(r.topic ? { topic: encodeTopic(r.topic) } : {}),
    ...(r.card ? { card: encodeCard(r.card) } : {})
  }
}

function decodeRecord(raw: Record<string, unknown>): SyncRecord {
  return {
    ...(raw.topic
      ? { topic: decodeTopic(raw.topic as Record<string, unknown>) }
      : {}),
    ...(raw.card
      ? { card: decodeCard(raw.card as Record<string, unknown>) }
      : {})
  }
}

function encodeConflict(c: TopicConflictResolved) {
  return {
    topicId: c.topicId,
    oldTitle: c.oldTitle,
    newTitle: c.newTitle,
    reason: c.reason,
    updatedAt: c.updatedAt
  }
}

function decodeConflict(raw: Record<string, unknown>): TopicConflictResolved {
  return {
    topicId: String(raw.topicId ?? ''),
    oldTitle: String(raw.oldTitle ?? ''),
    newTitle: String(raw.newTitle ?? ''),
    reason: String(raw.reason ?? ''),
    updatedAt: longToNumber(raw.updatedAt)
  }
}

function toWirePayload(envelope: SyncEnvelope): Record<string, unknown> {
  const base: Record<string, unknown> = {
    version: envelope.version,
    messageId: envelope.messageId,
    deviceId: envelope.deviceId,
    sentAt: envelope.sentAt
  }
  if (envelope.correlationId) base.correlationId = envelope.correlationId
  if (envelope.traceId) base.traceId = envelope.traceId

  switch (envelope.kind) {
    case 'hello':
      return {
        ...base,
        hello: {
          lastPulledAt: envelope.hello.lastPulledAt,
          pendingOpCount: envelope.hello.pendingOpCount,
          protocolVersion: envelope.hello.protocolVersion
        }
      }
    case 'helloAck':
      return {
        ...base,
        helloAck: {
          serverTime: envelope.helloAck.serverTime,
          missedSince: envelope.helloAck.missedSince,
          sessionId: envelope.helloAck.sessionId
        }
      }
    case 'pushBatch':
      return {
        ...base,
        pushBatch: {
          mutations: envelope.pushBatch.mutations.map(encodeMutation)
        }
      }
    case 'pushAck':
      return {
        ...base,
        pushAck: {
          acceptedOpIds: envelope.pushAck.acceptedOpIds,
          rejected: envelope.pushAck.rejected.map(r => ({
            opId: r.opId,
            code: r.code,
            message: r.message,
            retryable: r.retryable
          })),
          conflicts: envelope.pushAck.conflicts.map(encodeConflict)
        }
      }
    case 'pullDelta':
      return {
        ...base,
        pullDelta: {
          records: envelope.pullDelta.records.map(encodeRecord),
          watermark: envelope.pullDelta.watermark,
          more: envelope.pullDelta.more
        }
      }
    case 'pullRequest':
      return {
        ...base,
        pullRequest: { since: envelope.pullRequest.since }
      }
    case 'topicConflictResolved':
      return {
        ...base,
        topicConflictResolved: encodeConflict(envelope.topicConflictResolved)
      }
    case 'ping':
      return { ...base, ping: { timestamp: envelope.ping.timestamp } }
    case 'pong':
      return { ...base, pong: { timestamp: envelope.pong.timestamp } }
    case 'error':
      return {
        ...base,
        error: {
          code: envelope.error.code,
          message: envelope.error.message,
          retryable: envelope.error.retryable
        }
      }
    case 'gracefulClose':
      return {
        ...base,
        gracefulClose: { reason: envelope.gracefulClose.reason }
      }
  }
}

function fromWire(raw: Record<string, unknown>): SyncEnvelope {
  const meta = {
    version: Number(raw.version ?? 1),
    messageId: String(raw.messageId ?? ''),
    correlationId: raw.correlationId
      ? String(raw.correlationId)
      : undefined,
    deviceId: String(raw.deviceId ?? ''),
    sentAt: longToNumber(raw.sentAt),
    traceId: raw.traceId ? String(raw.traceId) : undefined
  }

  let payload: SyncEnvelopePayload

  if (raw.hello) {
    const h = raw.hello as Record<string, unknown>
    payload = {
      kind: 'hello',
      hello: {
        lastPulledAt: String(h.lastPulledAt ?? ''),
        pendingOpCount: Number(h.pendingOpCount ?? 0),
        protocolVersion: Number(h.protocolVersion ?? 1)
      }
    }
  } else if (raw.helloAck) {
    const h = raw.helloAck as Record<string, unknown>
    payload = {
      kind: 'helloAck',
      helloAck: {
        serverTime: longToNumber(h.serverTime),
        missedSince: String(h.missedSince ?? ''),
        sessionId: String(h.sessionId ?? '')
      }
    }
  } else if (raw.pushBatch) {
    const p = raw.pushBatch as Record<string, unknown>
    const mutations = (p.mutations as Record<string, unknown>[] | undefined) ?? []
    payload = {
      kind: 'pushBatch',
      pushBatch: { mutations: mutations.map(decodeMutation) }
    }
  } else if (raw.pushAck) {
    const p = raw.pushAck as Record<string, unknown>
    payload = {
      kind: 'pushAck',
      pushAck: {
        acceptedOpIds: ((p.acceptedOpIds as string[]) ?? []).map(String),
        rejected: ((p.rejected as Record<string, unknown>[]) ?? []).map(r => ({
          opId: String(r.opId ?? ''),
          code: String(r.code ?? ''),
          message: String(r.message ?? ''),
          retryable: Boolean(r.retryable)
        })),
        conflicts: ((p.conflicts as Record<string, unknown>[]) ?? []).map(
          decodeConflict
        )
      }
    }
  } else if (raw.pullDelta) {
    const p = raw.pullDelta as Record<string, unknown>
    payload = {
      kind: 'pullDelta',
      pullDelta: {
        records: ((p.records as Record<string, unknown>[]) ?? []).map(
          decodeRecord
        ),
        watermark: String(p.watermark ?? ''),
        more: Boolean(p.more)
      }
    }
  } else if (raw.pullRequest) {
    const p = raw.pullRequest as Record<string, unknown>
    payload = {
      kind: 'pullRequest',
      pullRequest: { since: String(p.since ?? '') }
    }
  } else if (raw.topicConflictResolved) {
    payload = {
      kind: 'topicConflictResolved',
      topicConflictResolved: decodeConflict(
        raw.topicConflictResolved as Record<string, unknown>
      )
    }
  } else if (raw.ping) {
    const p = raw.ping as Record<string, unknown>
    payload = { kind: 'ping', ping: { timestamp: longToNumber(p.timestamp) } }
  } else if (raw.pong) {
    const p = raw.pong as Record<string, unknown>
    payload = { kind: 'pong', pong: { timestamp: longToNumber(p.timestamp) } }
  } else if (raw.error) {
    const e = raw.error as Record<string, unknown>
    payload = {
      kind: 'error',
      error: {
        code: String(e.code ?? ''),
        message: String(e.message ?? ''),
        retryable: Boolean(e.retryable)
      }
    }
  } else if (raw.gracefulClose) {
    const g = raw.gracefulClose as Record<string, unknown>
    payload = {
      kind: 'gracefulClose',
      gracefulClose: { reason: String(g.reason ?? '') }
    }
  } else {
    throw new Error('SyncEnvelope missing payload')
  }

  return { ...meta, ...payload }
}

export function encodeEnvelope(envelope: SyncEnvelope): Uint8Array {
  const message = SyncEnvelopeType.create(toWirePayload(envelope))
  return SyncEnvelopeType.encode(message).finish()
}

export function decodeEnvelope(bytes: Uint8Array): SyncEnvelope {
  const decoded = SyncEnvelopeType.decode(bytes)
  const obj = SyncEnvelopeType.toObject(decoded, {
    longs: Number,
    enums: Number,
    defaults: true
  }) as Record<string, unknown>
  return fromWire(obj)
}
