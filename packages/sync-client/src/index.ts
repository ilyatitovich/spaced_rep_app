import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  decodeEnvelope,
  encodeEnvelope,
  type Mutation,
  type PullDelta,
  type PushAck,
  type SyncEnvelope
} from '@spaced-rep/sync-protocol'

export class SyncHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
  }
}

export function createHttpSyncClient(options: {
  apiUrl: string
  getAccessToken: () => Promise<string | null>
}) {
  const apiUrl = options.apiUrl.replace(/\/$/, '')

  async function post(path: string, envelope: SyncEnvelope) {
    const accessToken = await options.getAccessToken()
    if (!accessToken)
      throw new SyncHttpError(401, 'Not authenticated', 'UNAUTHORIZED')
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: encodeEnvelope(envelope)
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; code?: string }
      } | null
      throw new SyncHttpError(
        response.status,
        body?.error?.message ?? response.statusText,
        body?.error?.code
      )
    }
    return decodeEnvelope(await response.json())
  }

  const envelope = (deviceId: string) => ({
    version: PROTOCOL_VERSION,
    messageId: createEnvelopeId(),
    deviceId,
    sentAt: Date.now()
  })

  return {
    async push(deviceId: string, mutations: Mutation[]): Promise<PushAck> {
      const response = await post('/sync/push', {
        ...envelope(deviceId),
        kind: 'pushBatch',
        pushBatch: { mutations }
      })
      if (response.kind !== 'pushAck') throw new Error('Expected PushAck')
      return response.pushAck
    },
    async pull(deviceId: string, since: string): Promise<PullDelta> {
      const response = await post('/sync/pull', {
        ...envelope(deviceId),
        kind: 'pullRequest',
        pullRequest: { since }
      })
      if (response.kind !== 'pullDelta') throw new Error('Expected PullDelta')
      return response.pullDelta
    },
    async bootstrap(
      deviceId: string,
      lastPulledAt: string,
      pendingOpCount: number
    ): Promise<PullDelta> {
      const response = await post('/sync/bootstrap', {
        ...envelope(deviceId),
        kind: 'hello',
        hello: {
          lastPulledAt,
          pendingOpCount,
          protocolVersion: PROTOCOL_VERSION
        }
      })
      if (response.kind !== 'pullDelta') throw new Error('Expected PullDelta')
      return response.pullDelta
    }
  }
}
