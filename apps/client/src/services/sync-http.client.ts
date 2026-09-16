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
    // #region agent log
    fetch('http://127.0.0.1:7521/ingest/1bb57655-e58e-4cb4-86e4-aa8c75592027',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'039367'},body:JSON.stringify({sessionId:'039367',runId:'pre-fix',hypothesisId:'E',location:'sync-http.client.ts:postEnvelope',message:'sync HTTP missing token',data:{path},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7521/ingest/1bb57655-e58e-4cb4-86e4-aa8c75592027',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'039367'},body:JSON.stringify({sessionId:'039367',runId:'pre-fix',hypothesisId:'E',location:'sync-http.client.ts:postEnvelope',message:'sync HTTP error',data:{path,status:response.status,code,message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new ApiError(response.status, message, code)
  }

  // #region agent log
  fetch('http://127.0.0.1:7521/ingest/1bb57655-e58e-4cb4-86e4-aa8c75592027',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'039367'},body:JSON.stringify({sessionId:'039367',runId:'pre-fix',hypothesisId:'D',location:'sync-http.client.ts:postEnvelope',message:'sync HTTP ok',data:{path,kind:envelope.kind,mutationCount:envelope.kind==='pushBatch'?envelope.pushBatch.mutations.length:undefined},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
