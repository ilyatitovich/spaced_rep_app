import { createHttpSyncClient, SyncHttpError } from '@spaced-rep/sync-client'
import type { Mutation, PullDelta, PushAck } from '@spaced-rep/sync-protocol'
import { ensureFreshSession, ApiError } from '@/lib/api'
import { getAuthSession } from '@/lib/auth-storage'

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

export function getWsUrl(): string | null {
  if (!apiUrl) return null
  const url = new URL(apiUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/sync/ws'
  url.search = ''
  url.hash = ''
  return url.toString()
}
