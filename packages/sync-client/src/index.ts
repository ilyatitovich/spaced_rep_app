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
  /**
   * Called once when the server answers 401 to `rejectedToken`. Return a fresh
   * token to retry the request with, or null to surface the 401.
   */
  onUnauthorized?: (rejectedToken: string) => Promise<string | null>
}) {
  const apiUrl = options.apiUrl.replace(/\/$/, '')

  function send(path: string, accessToken: string, body: string) {
    return fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body
    })
  }

  async function post(path: string, envelope: SyncEnvelope) {
    const accessToken = await options.getAccessToken()
    if (!accessToken)
      throw new SyncHttpError(401, 'Not authenticated', 'UNAUTHORIZED')
    const body = encodeEnvelope(envelope)
    let response = await send(path, accessToken, body)
    if (response.status === 401 && options.onUnauthorized) {
      // The token we held was rejected (revoked, rotated, skewed clock):
      // refresh once and replay. The envelope is idempotent by messageId/opId.
      const fresh = await options.onUnauthorized(accessToken)
      if (fresh) response = await send(path, fresh, body)
    }
    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        error?: { message?: string; code?: string }
      } | null
      throw new SyncHttpError(
        response.status,
        errorBody?.error?.message ?? response.statusText,
        errorBody?.error?.code
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
