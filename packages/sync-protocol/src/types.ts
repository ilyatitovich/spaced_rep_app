/** Protocol version — bump on breaking wire changes. */
export const PROTOCOL_VERSION = 1

/** WebSocket frame magic byte (ASCII 'S'). */
export const FRAME_MAGIC = 0x53

export type SyncTable = 'topics' | 'cards'
export type SyncOperation = 'upsert' | 'delete'
export type OpAckStatus = 'accepted' | 'rejected' | 'conflict_resolved'

export type TopicRecord = {
  id: string
  title: string
  pivot: number
  weekJson: string
  nextUpdateDate: number
  updatedAt: number
  deletedAt?: number | null
}

export type CardRecord = {
  id: string
  topicId: string
  level: number
  dataJson: string
  reviewDate?: number | null
  updatedAt: number
  deletedAt?: number | null
}

export type Mutation = {
  opId: string
  deviceId: string
  table: SyncTable
  recordId: string
  operation: SyncOperation
  updatedAt: number
  topic?: TopicRecord
  card?: CardRecord
}

export type SyncRecord = {
  topic?: TopicRecord
  card?: CardRecord
}

export type Hello = {
  lastPulledAt: string
  pendingOpCount: number
  protocolVersion: number
}

export type HelloAck = {
  serverTime: number
  missedSince: string
  sessionId: string
}

export type PushBatch = {
  mutations: Mutation[]
}

export type RejectedOp = {
  opId: string
  code: string
  message: string
  retryable: boolean
}

export type TopicConflictResolved = {
  topicId: string
  oldTitle: string
  newTitle: string
  reason: string
  updatedAt: number
}

export type PushAck = {
  acceptedOpIds: string[]
  rejected: RejectedOp[]
  conflicts: TopicConflictResolved[]
}

export type PullDelta = {
  records: SyncRecord[]
  watermark: string
  more: boolean
}

export type PullRequest = {
  since: string
}

export type Ping = { timestamp: number }
export type Pong = { timestamp: number }

export type SyncError = {
  code: string
  message: string
  retryable: boolean
}

export type GracefulClose = { reason: string }

export type SyncEnvelopePayload =
  | { kind: 'hello'; hello: Hello }
  | { kind: 'helloAck'; helloAck: HelloAck }
  | { kind: 'pushBatch'; pushBatch: PushBatch }
  | { kind: 'pushAck'; pushAck: PushAck }
  | { kind: 'pullDelta'; pullDelta: PullDelta }
  | { kind: 'pullRequest'; pullRequest: PullRequest }
  | { kind: 'topicConflictResolved'; topicConflictResolved: TopicConflictResolved }
  | { kind: 'ping'; ping: Ping }
  | { kind: 'pong'; pong: Pong }
  | { kind: 'error'; error: SyncError }
  | { kind: 'gracefulClose'; gracefulClose: GracefulClose }

export type SyncEnvelope = {
  version: number
  messageId: string
  correlationId?: string
  deviceId: string
  sentAt: number
  traceId?: string
} & SyncEnvelopePayload
