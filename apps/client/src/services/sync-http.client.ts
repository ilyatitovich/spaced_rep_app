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
import { ensureFreshSession, ApiError } from '@/lib/api'
import { getAuthSession } from '@/lib/auth-storage'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

export function isServerSyncConfigured(): boolean {
  return Boolean(apiUrl)
}

async function getAccessToken(): Promise<string | null> {
  const fresh = await ensureFreshSession()
  return fresh?.accessToken ?? getAuthSession()?.accessToken ?? null
}

async function postEnvelope(
  path: string,
  envelope: SyncEnvelope
): Promise<SyncEnvelope> {
  if (!apiUrl) {
    throw new ApiError(0, 'VITE_API_URL is not configured')
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    throw new ApiError(401, 'Not authenticated', 'UNAUTHORIZED')
  }

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
    let message = response.statusText
    let code: string | undefined
    try {
      const json = (await response.json()) as {
        error?: { message?: string; code?: string }
      }
      message = json.error?.message ?? message
      code = json.error?.code
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(response.status, message, code)
  }

  return decodeEnvelope(await response.json())
}

export async function httpPushBatch(input: {
  deviceId: string
  mutations: Mutation[]
}): Promise<PushAck> {
  const envelope: SyncEnvelope = {
    version: PROTOCOL_VERSION,
    messageId: createEnvelopeId(),
    deviceId: input.deviceId,
    sentAt: Date.now(),
    kind: 'pushBatch',
    pushBatch: { mutations: input.mutations }
  }

  const response = await postEnvelope('/sync/push', envelope)
  if (response.kind !== 'pushAck') {
    throw new Error('Expected PushAck from /sync/push')
  }
  return response.pushAck
}

export async function httpPull(input: {
  deviceId: string
  since: string
}): Promise<PullDelta> {
  const envelope: SyncEnvelope = {
    version: PROTOCOL_VERSION,
    messageId: createEnvelopeId(),
    deviceId: input.deviceId,
    sentAt: Date.now(),
    kind: 'pullRequest',
    pullRequest: { since: input.since }
  }

  const response = await postEnvelope('/sync/pull', envelope)
  if (response.kind !== 'pullDelta') {
    throw new Error('Expected PullDelta from /sync/pull')
  }
  return response.pullDelta
}

export async function httpBootstrap(input: {
  deviceId: string
  lastPulledAt: string
  pendingOpCount: number
}): Promise<PullDelta> {
  const envelope: SyncEnvelope = {
    version: PROTOCOL_VERSION,
    messageId: createEnvelopeId(),
    deviceId: input.deviceId,
    sentAt: Date.now(),
    kind: 'hello',
    hello: {
      lastPulledAt: input.lastPulledAt,
      pendingOpCount: input.pendingOpCount,
      protocolVersion: PROTOCOL_VERSION
    }
  }

  const response = await postEnvelope('/sync/bootstrap', envelope)
  if (response.kind !== 'pullDelta') {
    throw new Error('Expected PullDelta from /sync/bootstrap')
  }
  return response.pullDelta
}

export function getWsUrl(): string | null {
  if (!apiUrl) return null
  const url = new URL(apiUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/sync/ws'
  url.search = ''
  url.hash = ''
  return url.toString()
}
