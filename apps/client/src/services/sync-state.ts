import type { STORES } from '@/lib/db'

export type SyncTable = typeof STORES.TOPICS | typeof STORES.CARDS
export type SyncOperation = 'upsert' | 'delete'

export interface FailedOp {
  opId: string
  table: SyncTable
  recordId: string
  code: string
  message: string
  at: number
}

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'error'
  | 'offline'
  | 'paused'
  | 'revoked'
  | 'update_required'

export type SyncConnection = 'idle' | 'ws' | 'http' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncedAt: number | null
  connection: SyncConnection
  queueDepth: number
  deviceId: string | null
  lastError: string | null
  failedOps: FailedOp[]
}

function initialState(): SyncState {
  return {
    status: 'idle',
    lastSyncedAt: null,
    connection: 'idle',
    queueDepth: 0,
    deviceId: null,
    lastError: null,
    failedOps: []
  }
}

let state: SyncState = initialState()
const listeners = new Set<(state: SyncState) => void>()

export function getSyncState(): SyncState {
  return state
}

export function setState(next: Partial<SyncState>): void {
  state = { ...state, ...next }
  listeners.forEach(listener => listener(state))
}

export function subscribeSync(
  listener: (state: SyncState) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test-only: drop the state without notifying listeners. */
export function resetSyncStateForTests(): void {
  state = initialState()
}
