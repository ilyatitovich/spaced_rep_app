import { STORES } from '@/lib/db'
import type { PullDelta, PushAck } from '@spaced-rep/sync-protocol'
import { table } from './fake-idb'

export const EPOCH_ISO = new Date(0).toISOString()

export function seedMeta(key: string, value: string): void {
  table(STORES.SYNC_META).set(key, { key, value })
}

export function metaValue(key: string): string | undefined {
  return (table(STORES.SYNC_META).get(key) as { value: string } | undefined)
    ?.value
}

export function emptyDelta(watermark = '2024-06-01T00:00:00.000Z'): PullDelta {
  return { records: [], watermark, more: false }
}

export function acceptAll(input: { mutations: { opId: string }[] }): PushAck {
  return {
    acceptedOpIds: input.mutations.map(m => m.opId),
    rejected: [],
    conflicts: []
  }
}

export function rejectAll(
  input: { mutations: { opId: string }[] },
  reject: { code: string; retryable: boolean; message?: string }
): PushAck {
  return {
    acceptedOpIds: [],
    rejected: input.mutations.map(m => ({
      opId: m.opId,
      message: `rejected: ${reject.code}`,
      ...reject
    })),
    conflicts: []
  }
}

export function rejectRetryable(input: {
  mutations: { opId: string }[]
}): PushAck {
  return rejectAll(input, {
    code: 'TRANSIENT',
    retryable: true,
    message: 'try later'
  })
}
