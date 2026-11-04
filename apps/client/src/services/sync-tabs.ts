import { hydrateStudyMemory } from './study-memory'
import { refreshSyncQueueDepth } from './sync-queue'

const SYNC_LOCK_NAME = 'spaced-rep-sync'
const CHANNEL_NAME = 'spaced-rep-study-data'

/**
 * Runs `task` while holding the sync lock shared by every tab of this origin.
 * Two tabs pushing the same outbox or applying the same delta would race on the
 * queue and the pull cursor; the second tab waits and then finds the work done.
 * Browsers without Web Locks run the task directly.
 */
export function withTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return task()
  return navigator.locks.request(SYNC_LOCK_NAME, task)
}

let channel: BroadcastChannel | null = null

/** Start hearing about study data other tabs changed. Safe to call repeatedly. */
export function startTabBroadcast(): void {
  if (channel || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = () => {
    // Another tab wrote to IndexedDB; this tab's memory is now behind it.
    void Promise.all([hydrateStudyMemory(), refreshSyncQueueDepth()]).catch(
      error => console.error('Reload after cross-tab change failed:', error)
    )
  }
}

export function stopTabBroadcast(): void {
  channel?.close()
  channel = null
}

/** Tell the other tabs that IndexedDB study data changed. */
export function announceStudyDataChange(): void {
  channel?.postMessage('changed')
}
