import { INITIAL_CURSOR } from '@spaced-rep/sync-protocol'
import { ApiError } from '@/lib/api'
import { STORES, withTransaction } from '@/lib/db'
import { promisifyRequest } from '@/lib'
import { isBackendConfigured, sync as syncBackend } from '@/providers'
import type { SyncRealtimeHandle } from '@/providers/types'
import type { Card, Topic } from '@/models'
import {
  clearStudyMemory,
  emitStudyData,
  getAllCardsFromMemory,
  getAllTopicsFromMemory,
  putCardInMemory,
  putTopicInMemory,
  subscribeStudyData
} from './study-memory'
import {
  CURSOR_KEY,
  DEVICE_ID_KEY,
  LAST_SYNC_AT_KEY,
  getCursor,
  getDeviceId,
  getMeta,
  loadFailedOps,
  setMeta
} from './sync-meta'
import {
  applyPullDelta,
  applyTopicConflict,
  bootstrapPull,
  pullChanges,
  resetPullStateForTests
} from './sync-pull'
import { pushQueue } from './sync-push'
import {
  backoffMs,
  enqueueSync,
  getQueue,
  inFlightOpIds,
  refreshSyncQueueDepth
} from './sync-queue'
import {
  getSyncState,
  resetSyncStateForTests,
  setState,
  type FailedOp
} from './sync-state'
import { startTabBroadcast, stopTabBroadcast, withTabLock } from './sync-tabs'
import type { WsConnectionState } from './sync-ws.manager'

export {
  coalesceQueuedOperation,
  enqueueSync,
  enqueueSyncBulk,
  putSyncQueueOps,
  refreshSyncQueueDepth,
  type SyncEnqueueOp
} from './sync-queue'
export { recordToTopic, topicToRecord } from './sync-records'
export { applyPullDelta } from './sync-pull'
export { getDeviceId } from './sync-meta'
export {
  getSyncState,
  subscribeSync,
  type SyncConnection,
  type SyncState,
  type SyncStatus
} from './sync-state'

const TRIGGER_DEBOUNCE_MS = 1500
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
/** How long sign-out waits to push the outbox before asking the user. */
const SIGN_OUT_FLUSH_TIMEOUT_MS = 10_000
/** How long the wipe waits for the old account's run before wiping anyway. */
const WIPE_WAIT_RUN_MS = 10_000

let currentUserId: string | null = null
let syncEntitled = false
let triggerTimer: ReturnType<typeof setTimeout> | null = null
let syncMutex: Promise<void> | null = null
/** A syncAll was requested while one was running — run another pass after it. */
let pendingSyncAll = false
/** In-flight sign-out wipe; initialSync waits on it so a fast re-login can't race it. */
let pendingClear: Promise<void> | null = null
let realtime: SyncRealtimeHandle | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempts = 0

/**
 * Single-flight within this tab (a caller joins the run in progress) and
 * exclusive across tabs (the run waits for another tab's run to finish).
 */
function withSyncMutex(fn: () => Promise<void>): Promise<void> {
  if (syncMutex) return syncMutex
  syncMutex = withTabLock(fn).finally(() => {
    syncMutex = null
  })
  return syncMutex
}

/** Resolves when `promise` settles or after `ms`, whichever is first. Never rejects. */
async function settleWithin(
  promise: Promise<unknown>,
  ms: number
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      promise.catch(() => undefined),
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, ms)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

function pauseSync(message = 'Upgrade to Pro to sync'): void {
  syncEntitled = false
  realtime?.disconnect()
  setState({
    status: 'paused',
    connection: 'idle',
    lastError: message
  })
}

/** Keep Pro entitlement — user can mint a new deviceId via reconnectRevokedDevice. */
function markDeviceRevoked(): void {
  realtime?.disconnect()
  setState({
    status: 'revoked',
    connection: 'idle',
    lastError: 'This device was disconnected from sync'
  })
}

/** Hard protocol cutover — keep local data/outbox; stop sync until the app is updated. */
function markUpdateRequired(): void {
  syncEntitled = false
  realtime?.disconnect()
  setState({
    status: 'update_required',
    connection: 'idle',
    lastError: 'Update the app to continue syncing'
  })
}

function isDeviceRevokedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'DEVICE_REVOKED'
}

function isProtocolMismatchError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'PROTOCOL_MISMATCH'
}

function isPaidAccessError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'PLAN_REQUIRED' || error.code === 'DEVICE_LIMIT')
  )
}

function handleSyncAccessError(error: unknown): boolean {
  if (isDeviceRevokedError(error)) {
    markDeviceRevoked()
    return true
  }
  if (isProtocolMismatchError(error)) {
    markUpdateRequired()
    return true
  }
  if (isPaidAccessError(error)) {
    pauseSync(error instanceof Error ? error.message : undefined)
    return true
  }
  return false
}

/** Network failures and server-side hiccups: waiting and trying again can fix them. */
function isTransientSyncError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 408 || error.status === 429
  }
  // fetch() rejects with a TypeError when the network is unreachable.
  return error instanceof TypeError
}

function cancelSyncRetry(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryAttempts = 0
}

/** Retry a failed run after an exponentially growing delay. */
function scheduleSyncRetry(): void {
  if (retryTimer) return
  retryAttempts += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    const online = typeof navigator === 'undefined' || navigator.onLine
    // Offline: the browser's online event triggers the next sync.
    if (!online || !currentUserId || getSyncState().status !== 'error') return
    void syncAll(currentUserId)
  }, backoffMs(retryAttempts))
}

/** Record a failed run: surface it, and retry if it was only transient. */
function failRun(error: unknown, fallbackMessage: string): void {
  setState({
    status: 'error',
    lastError: error instanceof Error ? error.message : fallbackMessage
  })
  if (isTransientSyncError(error) && syncEntitled) scheduleSyncRetry()
}

export function subscribeSyncData(listener: () => void): () => void {
  return subscribeStudyData(listener)
}

function emitSyncData(): void {
  emitStudyData()
}

/**
 * Drains the outbox. Returns max updatedAt among accepted mutations.
 * Uses the realtime socket when it is active, HTTP otherwise.
 */
export function pushChanges(deviceId: string): Promise<number> {
  return pushQueue(deviceId, realtime)
}

function wireRealtimeListeners(): void {
  if (!syncBackend?.connectRealtime) return

  realtime = syncBackend.connectRealtime({
    onDelta: delta => {
      // applyPullDelta serializes with every other apply.
      void applyPullDelta(delta).catch(err => {
        console.error('WS delta apply failed:', err)
        // Hydrate/verify failed before watermark advance — a full pass pulls
        // the range again, under the same single-flight as any other sync.
        if (currentUserId) void syncAll(currentUserId)
      })
    },
    onConflict: conflict => {
      void applyTopicConflict(conflict).catch(err =>
        console.error('WS conflict apply failed:', err)
      )
    },
    onStateChange: wsState => {
      if (wsState === 'active') {
        setState({ connection: 'ws' })
        void flushAfterConnect()
      } else if (
        wsState === 'disconnected' &&
        getSyncState().connection === 'ws'
      ) {
        setState({ connection: 'idle' })
      }
    },
    onTokenExpired: () => {
      void ensureRealtimeReconnectWithFreshToken()
    },
    onPlanRequired: () => {
      pauseSync()
    },
    onDeviceRevoked: () => {
      markDeviceRevoked()
    },
    onProtocolMismatch: () => {
      markUpdateRequired()
    }
  })
}

async function realtimeResume(): Promise<{
  deviceId: string
  lastPulledAt: string
  pendingOpCount: number
}> {
  return {
    deviceId: await getDeviceId(),
    lastPulledAt: await getCursor(),
    pendingOpCount: (await getQueue()).length
  }
}

async function ensureRealtimeReconnectWithFreshToken(): Promise<void> {
  realtime?.disconnect()
  if (!currentUserId || !syncEntitled || !realtime) return
  await realtime.connect(await realtimeResume())
}

/** A socket just came up: push what queued while it was down. */
async function flushAfterConnect(): Promise<void> {
  if (!currentUserId || !syncEntitled) return
  if ((await getQueue()).length === 0) return
  if (syncMutex) {
    // A run is in flight and may have missed the outbox; it loops once more.
    pendingSyncAll = true
    return
  }
  try {
    await withSyncMutex(async () => {
      await pushChanges(await getDeviceId())
    })
  } catch (err) {
    console.error('Post-connect flush failed:', err)
  }
}

async function connectRealtime(): Promise<void> {
  if (!syncEntitled || !realtime) return
  const resume = await realtimeResume()
  realtime.updateResume?.(resume.lastPulledAt, resume.pendingOpCount)
  await realtime.connect(resume)
}

export async function syncAll(_userId: string): Promise<void> {
  if (!syncEntitled || !isBackendConfigured() || !syncBackend) {
    return
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ status: 'offline', connection: 'offline' })
    return
  }

  if (pendingClear) {
    // The previous account is still being wiped; syncing now would mix the two.
    await pendingClear
    if (!syncEntitled || !currentUserId) return
  }

  if (syncMutex) {
    // Edits made while a run is in flight may have missed its push — rerun after.
    pendingSyncAll = true
    return syncMutex
  }

  return withSyncMutex(runSyncAllPasses)
}

/** Loop push+pull while another syncAll was requested during the run. */
async function runSyncAllPasses(): Promise<void> {
  do {
    pendingSyncAll = false
    await runSyncAllOnce()
  } while (pendingSyncAll && syncEntitled && currentUserId)
  pendingSyncAll = false
}

async function runSyncAllOnce(): Promise<void> {
  setState({ status: 'syncing', lastError: null })

  try {
    const deviceId = await getDeviceId()
    setState({ deviceId })

    const lastSyncAt = await getMeta(LAST_SYNC_AT_KEY)
    if (
      lastSyncAt !== undefined &&
      Date.now() - Number(lastSyncAt) > ACTIVE_WINDOW_MS
    ) {
      await bootstrapPull(deviceId, INITIAL_CURSOR)
    }

    await pushChanges(deviceId)
    // Always pull after push: the server may have kept a different (winning)
    // row for something we just pushed. Watermark only moves forward.
    await pullChanges(deviceId)

    await markSynced()
    cancelSyncRetry()

    if (realtime && !realtime.isActive()) {
      await connectRealtime()
    }
  } catch (error) {
    console.error('Sync failed:', error)
    if (handleSyncAccessError(error)) {
      pendingSyncAll = false
      return
    }
    failRun(error, 'Sync failed')
  }
}

async function markSynced(): Promise<void> {
  await setMeta(LAST_SYNC_AT_KEY, String(Date.now()))
  setState({
    status: 'idle',
    lastSyncedAt: Date.now(),
    queueDepth: (await getQueue()).length
  })
}

/** Wipe local study data + queue (sign-out / account switch). Keeps deviceId. */
export async function clearLocalSyncData(): Promise<void> {
  const snap = {
    topics: getAllTopicsFromMemory(),
    cards: getAllCardsFromMemory()
  }
  clearStudyMemory()
  emitSyncData()
  try {
    await withTransaction(
      [STORES.TOPICS, STORES.CARDS, STORES.SYNC_QUEUE, STORES.SYNC_META],
      'readwrite',
      async stores => {
        await promisifyRequest(stores[STORES.TOPICS].clear())
        await promisifyRequest(stores[STORES.CARDS].clear())
        await promisifyRequest(stores[STORES.SYNC_QUEUE].clear())

        const meta = stores[STORES.SYNC_META]
        const rows = await promisifyRequest<{ key: string }[]>(meta.getAll())
        for (const row of rows) {
          if (row.key !== DEVICE_ID_KEY) {
            await promisifyRequest(meta.delete(row.key))
          }
        }
        await promisifyRequest(
          meta.put({ key: CURSOR_KEY, value: INITIAL_CURSOR })
        )
      }
    )
  } catch (error) {
    for (const topic of snap.topics) putTopicInMemory(topic)
    for (const card of snap.cards) putCardInMemory(card)
    emitSyncData()
    throw error
  }
  setState({ queueDepth: 0, failedOps: [] })
}

/** Test-only: drop module-level sync state so tests don't leak into each other. */
export function __resetSyncServiceForTests(): void {
  syncMutex = null
  pendingSyncAll = false
  pendingClear = null
  syncEntitled = false
  currentUserId = null
  realtime = null
  if (triggerTimer) clearTimeout(triggerTimer)
  triggerTimer = null
  cancelSyncRetry()
  stopTabBroadcast()
  resetPullStateForTests()
  inFlightOpIds.clear()
  resetSyncStateForTests()
}

async function migrateLocalToCloud(): Promise<void> {
  const [topics, cards] = await Promise.all([
    withTransaction(STORES.TOPICS, 'readonly', stores =>
      promisifyRequest<Topic[]>(stores[STORES.TOPICS].getAll())
    ),
    withTransaction(STORES.CARDS, 'readonly', stores =>
      promisifyRequest<Card[]>(stores[STORES.CARDS].getAll())
    )
  ])

  for (const topic of topics) {
    await enqueueSync(STORES.TOPICS, topic.id, 'upsert')
  }
  for (const card of cards) {
    await enqueueSync(STORES.CARDS, card.id, 'upsert')
  }
}

/**
 * Wipe the account we just left, after its in-flight run ends. Wiping under a
 * running sync lets a late pull re-seed the store with that account's rows,
 * which the next sign-in would then adopt as guest data.
 */
function scheduleAccountWipe(): void {
  const previousWipe = pendingClear ?? Promise.resolve()
  const wipe: Promise<void> = (async () => {
    await previousWipe
    if (syncMutex) await settleWithin(syncMutex, WIPE_WAIT_RUN_MS)
    await clearLocalSyncData()
  })()
    .catch(err => console.error('Account wipe failed:', err))
    .finally(() => {
      if (pendingClear === wipe) pendingClear = null
    })
  pendingClear = wipe
}

export function setSyncUser(userId: string | null): void {
  const previousUserId = currentUserId
  const changed = previousUserId !== userId
  if (changed) {
    syncEntitled = false
    pendingSyncAll = false
    if (triggerTimer) clearTimeout(triggerTimer)
    triggerTimer = null
    cancelSyncRetry()
    // The socket is authenticated as the old account.
    realtime?.disconnect()
  }
  currentUserId = userId

  // Leaving an account (sign-out or direct switch) wipes it. The initial
  // signed-out render must not erase guest data, so null -> X never wipes.
  if (changed && previousUserId !== null) scheduleAccountWipe()

  if (!userId) {
    stopTabBroadcast()
    setState({
      status: 'idle',
      connection: 'idle',
      deviceId: null,
      lastError: null,
      failedOps: []
    })
  } else {
    startTabBroadcast()
    void loadFailedOps().then(ops => setState({ failedOps: ops }))
    void getDeviceId().then(id => setState({ deviceId: id }))
    void refreshSyncQueueDepth()
  }
}

/**
 * Best-effort push of the outbox before the session is dropped. Returns how
 * many queued changes are still unsynced (offline, not entitled, rejected or
 * timed out) so the caller can warn before they are wiped.
 */
export async function flushPendingChanges(
  timeoutMs = SIGN_OUT_FLUSH_TIMEOUT_MS
): Promise<number> {
  if (currentUserId && syncEntitled && isBackendConfigured() && syncBackend) {
    await settleWithin(syncAll(currentUserId), timeoutMs)
  }
  return (await getQueue()).length
}

export function setSyncEntitlement(entitled: boolean): boolean {
  const becameEntitled = entitled && !syncEntitled
  syncEntitled = entitled
  if (!entitled) {
    if (currentUserId) pauseSync()
    else realtime?.disconnect()
  } else if (currentUserId && getSyncState().status === 'paused') {
    setState({ status: 'idle', lastError: null })
  }
  return becameEntitled
}

/**
 * Bootstrap from the stored cursor, push, and mark synced. Shared by the first
 * sync after sign-in and the rejoin after a revoked device.
 */
async function bootstrapAndPush(deviceId: string): Promise<void> {
  await bootstrapPull(deviceId, await getCursor())
  await pushChanges(deviceId)
  await markSynced()
  cancelSyncRetry()
}

export async function initialSync(userId: string): Promise<void> {
  if (!syncEntitled || !isBackendConfigured() || !syncBackend) {
    return
  }

  // Before the single-flight check: the previous account's run may still hold
  // the mutex, and joining it would swallow this call.
  if (pendingClear) {
    await pendingClear
    if (!syncEntitled || currentUserId !== userId) return
  }

  if (syncMutex) {
    return syncMutex
  }

  return withSyncMutex(async () => {
    wireRealtimeListeners()

    const migratedUserId = await getMeta('migratedUserId')
    if (migratedUserId !== userId) {
      if (migratedUserId === undefined) {
        // Guest data from before first sign-in: adopt into this account.
        await migrateLocalToCloud()
      } else {
        // Another account's data lives here — never upload it as this user's.
        await clearLocalSyncData()
      }
      await setMeta('migratedUserId', userId)
    }

    const deviceId = await getDeviceId()
    setState({ deviceId })

    try {
      setState({ status: 'syncing' })
      await bootstrapAndPush(deviceId)
    } catch (error) {
      console.error('Initial sync failed:', error)
      if (handleSyncAccessError(error)) return
      failRun(error, 'Initial sync failed')
    }

    await connectRealtime()

    // A syncAll arrived mid-initialSync (single-flight): honour it now.
    if (pendingSyncAll) await runSyncAllPasses()
  })
}

/** Mint a new sync deviceId and rejoin after DEVICE_REVOKED. Uses a Pro slot. */
export async function reconnectRevokedDevice(): Promise<void> {
  if (
    !currentUserId ||
    !syncEntitled ||
    !isBackendConfigured() ||
    !syncBackend
  ) {
    return
  }
  if (getSyncState().status === 'syncing') return

  realtime?.disconnect()

  const deviceId = crypto.randomUUID()
  await setMeta(DEVICE_ID_KEY, deviceId)
  setState({ deviceId, status: 'syncing', lastError: null })

  return withSyncMutex(async () => {
    wireRealtimeListeners()
    try {
      await bootstrapAndPush(deviceId)
      await connectRealtime()
    } catch (error) {
      console.error('Reconnect sync failed:', error)
      if (handleSyncAccessError(error)) return
      failRun(error, 'Reconnect failed')
    }
  })
}

export function syncNow(): void {
  const status = getSyncState().status
  if (
    !currentUserId ||
    !syncEntitled ||
    status === 'revoked' ||
    status === 'update_required'
  )
    return
  void syncAll(currentUserId)
}

export function triggerSync(): void {
  const status = getSyncState().status
  if (
    !currentUserId ||
    !syncEntitled ||
    status === 'revoked' ||
    status === 'update_required' ||
    !isBackendConfigured()
  )
    return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  if (triggerTimer) clearTimeout(triggerTimer)
  triggerTimer = setTimeout(() => {
    triggerTimer = null
    if (currentUserId) void syncAll(currentUserId)
  }, TRIGGER_DEBOUNCE_MS)
}

export async function getSyncDiagnostics(): Promise<{
  deviceId: string
  lastPulledAt: string
  queueDepth: number
  wsState: WsConnectionState
  failedOps: FailedOp[]
}> {
  const wsState: WsConnectionState = realtime?.isActive()
    ? 'active'
    : 'disconnected'
  return {
    deviceId: await getDeviceId(),
    lastPulledAt: await getCursor(),
    queueDepth: (await getQueue()).length,
    wsState,
    failedOps: await loadFailedOps()
  }
}
