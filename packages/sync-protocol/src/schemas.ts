import { z } from 'zod'

export const PROTOCOL_VERSION = 3

/** Lowercase hex SHA-256 digest. */
export const SHA256_HEX = /^[0-9a-f]{64}$/

/** Owned media on the sync wire and in Postgres (not local card storage). */
export const WireMediaRefSchema = z.object({
  hash: z
    .string()
    .regex(SHA256_HEX, 'hash must be lowercase SHA-256 hex'),
  type: z.string().min(1),
  byteLength: z.number().int().positive()
})

export const SyncTableSchema = z.enum(['topics', 'cards'])
export const SyncOperationSchema = z.enum(['upsert', 'delete'])
export const OpAckStatusSchema = z.enum([
  'accepted',
  'rejected',
  'conflict_resolved'
])

export const TopicRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  pivot: z.number(),
  weekJson: z.string(),
  nextUpdateDate: z.number(),
  // Nullish: clients older than this field must still validate.
  isArchived: z.boolean().nullish(),
  updatedAt: z.number(),
  deletedAt: z.number().nullish()
})

export const CardRecordSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  level: z.number().int(),
  dataJson: z.string(),
  reviewDate: z.number().nullish(),
  updatedAt: z.number(),
  deletedAt: z.number().nullish()
})

export const MutationSchema = z.object({
  opId: z.string(),
  deviceId: z.string(),
  table: SyncTableSchema,
  recordId: z.string(),
  operation: SyncOperationSchema,
  updatedAt: z.number(),
  topic: TopicRecordSchema.optional(),
  card: CardRecordSchema.optional()
})

export const SyncRecordSchema = z.object({
  topic: TopicRecordSchema.optional(),
  card: CardRecordSchema.optional()
})

export const HelloSchema = z.object({
  lastPulledAt: z.string(),
  pendingOpCount: z.number().int(),
  protocolVersion: z.number().int()
})

export const HelloAckSchema = z.object({
  serverTime: z.number(),
  missedSince: z.string(),
  sessionId: z.string()
})

export const PushBatchSchema = z.object({
  mutations: z.array(MutationSchema)
})

export const RejectedOpSchema = z.object({
  opId: z.string(),
  code: z.string(),
  message: z.string(),
  retryable: z.boolean()
})

export const TopicConflictResolvedSchema = z.object({
  topicId: z.string(),
  oldTitle: z.string(),
  newTitle: z.string(),
  reason: z.string(),
  updatedAt: z.number()
})

export const PushAckSchema = z.object({
  acceptedOpIds: z.array(z.string()),
  rejected: z.array(RejectedOpSchema),
  conflicts: z.array(TopicConflictResolvedSchema)
})

export const PullDeltaSchema = z.object({
  records: z.array(SyncRecordSchema),
  watermark: z.string(),
  more: z.boolean()
})

export const PullRequestSchema = z.object({
  since: z.string()
})

export const PingSchema = z.object({ timestamp: z.number() })
export const PongSchema = z.object({ timestamp: z.number() })

export const SyncErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean()
})

export const GracefulCloseSchema = z.object({
  reason: z.string()
})

const envelopeMeta = {
  version: z.number().int(),
  messageId: z.string(),
  correlationId: z.string().optional(),
  deviceId: z.string(),
  sentAt: z.number(),
  traceId: z.string().optional()
}

export const SyncEnvelopeSchema = z.discriminatedUnion('kind', [
  z.object({
    ...envelopeMeta,
    kind: z.literal('hello'),
    hello: HelloSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('helloAck'),
    helloAck: HelloAckSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('pushBatch'),
    pushBatch: PushBatchSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('pushAck'),
    pushAck: PushAckSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('pullDelta'),
    pullDelta: PullDeltaSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('pullRequest'),
    pullRequest: PullRequestSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('topicConflictResolved'),
    topicConflictResolved: TopicConflictResolvedSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('ping'),
    ping: PingSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('pong'),
    pong: PongSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('error'),
    error: SyncErrorSchema
  }),
  z.object({
    ...envelopeMeta,
    kind: z.literal('gracefulClose'),
    gracefulClose: GracefulCloseSchema
  })
])

export type WireMediaRef = z.infer<typeof WireMediaRefSchema>
export type SyncTable = z.infer<typeof SyncTableSchema>
export type SyncOperation = z.infer<typeof SyncOperationSchema>
export type OpAckStatus = z.infer<typeof OpAckStatusSchema>
export type TopicRecord = z.infer<typeof TopicRecordSchema>
export type CardRecord = z.infer<typeof CardRecordSchema>
export type Mutation = z.infer<typeof MutationSchema>
export type SyncRecord = z.infer<typeof SyncRecordSchema>
export type Hello = z.infer<typeof HelloSchema>
export type HelloAck = z.infer<typeof HelloAckSchema>
export type PushBatch = z.infer<typeof PushBatchSchema>
export type RejectedOp = z.infer<typeof RejectedOpSchema>
export type TopicConflictResolved = z.infer<typeof TopicConflictResolvedSchema>
export type PushAck = z.infer<typeof PushAckSchema>
export type PullDelta = z.infer<typeof PullDeltaSchema>
export type PullRequest = z.infer<typeof PullRequestSchema>
export type Ping = z.infer<typeof PingSchema>
export type Pong = z.infer<typeof PongSchema>
export type SyncError = z.infer<typeof SyncErrorSchema>
export type GracefulClose = z.infer<typeof GracefulCloseSchema>
export type SyncEnvelope = z.infer<typeof SyncEnvelopeSchema>
export type SyncEnvelopePayload = Omit<
  SyncEnvelope,
  'version' | 'messageId' | 'correlationId' | 'deviceId' | 'sentAt' | 'traceId'
>
