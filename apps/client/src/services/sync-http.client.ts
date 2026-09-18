import { createHttpSyncClient, SyncHttpError } from '@spaced-rep/sync-client'
import type { Mutation, PullDelta, PushAck } from '@spaced-rep/sync-protocol'
import { ensureFreshSession, ApiError } from '@/lib/api'
import { getAuthSession } from '@/lib/auth-storage'
import type {
  MediaDownloadPlanItem,
  MediaUploadPlanItem,
  SyncMediaApi
} from '@/lib/sync-media'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''
const client = createHttpSyncClient({
  apiUrl,
  getAccessToken: async () =>
    (await ensureFreshSession())?.accessToken ??
    getAuthSession()?.accessToken ??
    null
})

async function mapError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof SyncHttpError) {
      throw new ApiError(error.status, error.message, error.code)
    }
    throw error
  }
}

async function getAccessToken(): Promise<string> {
  const accessToken =
    (await ensureFreshSession())?.accessToken ??
    getAuthSession()?.accessToken ??
    null
  if (!accessToken) {
    throw new ApiError(401, 'Not authenticated', 'UNAUTHORIZED')
  }
  return accessToken
}

async function postMediaJson<T>(path: string, body: unknown): Promise<T> {
  if (!apiUrl) {
    throw new ApiError(0, 'VITE_API_URL is not configured')
  }
  const accessToken = await getAccessToken()
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const json = (await response.json().catch(() => null)) as {
    data?: T
    error?: { message?: string; code?: string }
  } | null
  if (!response.ok) {
    throw new ApiError(
      response.status,
      json?.error?.message ?? response.statusText,
      json?.error?.code
    )
  }
  if (json?.data === undefined) {
    throw new ApiError(500, 'Invalid media response')
  }
  return json.data
}

export function isServerSyncConfigured(): boolean {
  return Boolean(apiUrl)
}

export function httpPushBatch(input: {
  deviceId: string
  mutations: Mutation[]
}): Promise<PushAck> {
  return mapError(() => client.push(input.deviceId, input.mutations))
}

export function httpPull(input: {
  deviceId: string
  since: string
}): Promise<PullDelta> {
  return mapError(() => client.pull(input.deviceId, input.since))
}

export function httpBootstrap(input: {
  deviceId: string
  lastPulledAt: string
  pendingOpCount: number
}): Promise<PullDelta> {
  return mapError(() =>
    client.bootstrap(input.deviceId, input.lastPulledAt, input.pendingOpCount)
  )
}

export const httpSyncMediaApi: SyncMediaApi = {
  async planUploads(items) {
    const data = await postMediaJson<{ items: MediaUploadPlanItem[] }>(
      '/sync/media/uploads',
      { items }
    )
    return data.items
  },
  async planDownloads(hashes) {
    const data = await postMediaJson<{ items: MediaDownloadPlanItem[] }>(
      '/sync/media/downloads',
      { hashes }
    )
    return data.items
  }
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
