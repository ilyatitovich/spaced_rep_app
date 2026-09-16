import { SyncEnvelopeSchema, type SyncEnvelope } from './schemas.js'

export function createEnvelopeId(): string {
  return crypto.randomUUID()
}

/** Serialize a sync envelope as JSON text. */
export function encodeEnvelope(envelope: SyncEnvelope): string {
  return JSON.stringify(envelope)
}

/** Parse + validate a sync envelope from JSON text or a plain object. */
export function decodeEnvelope(input: unknown): SyncEnvelope {
  const value =
    typeof input === 'string' ? (JSON.parse(input) as unknown) : input
  return SyncEnvelopeSchema.parse(value)
}
