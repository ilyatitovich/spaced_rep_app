const DB_NAME = 'spacedRepApp'
const DB_VERSION = 6
const IDLE_CLOSE_MS = 30_000

export const STORES = {
  TOPICS: 'topics',
  CARDS: 'cards',
  SYNC_QUEUE: 'sync_queue',
  SYNC_META: 'sync_meta',
  USER_PREFERENCES: 'user_preferences',
  USER_LEARNING_SETTINGS: 'user_learning_settings',
  USER_NOTIFICATION_SETTINGS: 'user_notification_settings',
  NOTIFICATION_REMINDERS: 'notification_reminders',
  SUBSCRIPTION_CACHE: 'subscription_cache',
  SETTINGS_OUTBOX: 'settings_outbox',
  MEDIA_CACHE: 'media_cache'
} as const

/** Compound index on cards for level-scoped queries */
export const CARDS_TOPIC_LEVEL_INDEX = 'topicId_level'

export const QUOTA_EXCEEDED_MESSAGE =
  'This device is out of storage. Export your data, then clear cached images.'

let dbPromise: Promise<IDBDatabase> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let cachedDb: IDBDatabase | null = null

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function dropCache(): void {
  clearIdleTimer()
  dbPromise = null
  cachedDb = null
}

function scheduleIdleClose(db: IDBDatabase): void {
  clearIdleTimer()
  idleTimer = setTimeout(() => {
    idleTimer = null
    if (cachedDb === db) {
      db.close()
      dropCache()
    }
  }, IDLE_CLOSE_MS)
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result
      const tx = (event.target as IDBOpenDBRequest).transaction
      const oldVersion = event.oldVersion

      if (!db.objectStoreNames.contains(STORES.TOPICS)) {
        const topicStore = db.createObjectStore(STORES.TOPICS, {
          keyPath: 'id'
        })
        topicStore.createIndex('title', 'title', { unique: true })
      }

      if (!db.objectStoreNames.contains(STORES.CARDS)) {
        const cardStore = db.createObjectStore(STORES.CARDS, { keyPath: 'id' })
        cardStore.createIndex('topicId', 'topicId', { unique: false })
        cardStore.createIndex(CARDS_TOPIC_LEVEL_INDEX, ['topicId', 'level'], {
          unique: false
        })
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
        db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
        db.createObjectStore(STORES.USER_PREFERENCES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.USER_LEARNING_SETTINGS)) {
        db.createObjectStore(STORES.USER_LEARNING_SETTINGS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.USER_NOTIFICATION_SETTINGS)) {
        db.createObjectStore(STORES.USER_NOTIFICATION_SETTINGS, {
          keyPath: 'id'
        })
      }
      if (!db.objectStoreNames.contains(STORES.NOTIFICATION_REMINDERS)) {
        const rem = db.createObjectStore(STORES.NOTIFICATION_REMINDERS, {
          keyPath: 'id'
        })
        rem.createIndex('ownerKey', 'ownerKey', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.SUBSCRIPTION_CACHE)) {
        db.createObjectStore(STORES.SUBSCRIPTION_CACHE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS_OUTBOX)) {
        db.createObjectStore(STORES.SETTINGS_OUTBOX, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORES.MEDIA_CACHE)) {
        db.createObjectStore(STORES.MEDIA_CACHE, { keyPath: 'url' })
      }

      // v3: queue items may gain opId/attempts/nextRetryAt — no schema change needed
      // v4: user settings stores
      // v5: cards compound index [topicId, level]
      // v6: media_cache for remote Anki images keyed by URL
      if (oldVersion > 0 && oldVersion < 5 && tx) {
        const cardStore = tx.objectStore(STORES.CARDS)
        if (!cardStore.indexNames.contains(CARDS_TOPIC_LEVEL_INDEX)) {
          cardStore.createIndex(CARDS_TOPIC_LEVEL_INDEX, ['topicId', 'level'], {
            unique: false
          })
        }
      }
    }

    request.onblocked = () => {
      reject(
        new Error(
          'Database upgrade blocked. Close other tabs using this app and try again.'
        )
      )
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        if (cachedDb === db) dropCache()
      }
      cachedDb = db
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
}

function getDatabase(): Promise<IDBDatabase> {
  clearIdleTimer()
  dbPromise ??= openDatabase().catch(err => {
    dropCache()
    throw err
  })
  return dbPromise
}

/** Close the cached connection immediately (tests / teardown). */
export function closeDatabase(): void {
  const db = cachedDb
  dropCache()
  db?.close()
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  return name === 'QuotaExceededError'
}

function mapTransactionError(error: unknown): unknown {
  if (isQuotaExceededError(error)) {
    return new Error(QUOTA_EXCEEDED_MESSAGE, { cause: error })
  }
  return error
}

export async function withTransaction<T, const K extends string>(
  storeNames: readonly K[] | K,
  mode: IDBTransactionMode,
  callback: (stores: { [P in K]: IDBObjectStore }) => Promise<T>
): Promise<T> {
  const db = await getDatabase()
  const storeList = (
    Array.isArray(storeNames) ? storeNames : [storeNames]
  ) as readonly K[]
  const transaction = db.transaction([...storeList], mode)

  const stores = {} as { [P in K]: IDBObjectStore }
  for (const name of storeList) {
    stores[name] = transaction.objectStore(name)
  }

  const txDone = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => {
      reject(transaction.error || new Error('Transaction aborted'))
    }
    transaction.onerror = () => {
      reject(transaction.error || new Error('Unknown transaction error'))
    }
  })

  let callbackError: unknown
  let result!: T

  try {
    try {
      result = await callback(stores)
    } catch (err) {
      callbackError = err
      try {
        transaction.abort()
      } catch {
        // already aborting
      }
    }

    try {
      await txDone
    } catch (txErr) {
      throw mapTransactionError(callbackError ?? txErr)
    }

    if (callbackError !== undefined) {
      throw mapTransactionError(callbackError)
    }

    return result
  } finally {
    scheduleIdleClose(db)
  }
}
