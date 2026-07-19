const DB_NAME = 'spacedRepApp'
const DB_VERSION = 4
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
  SETTINGS_OUTBOX: 'settings_outbox'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result
      const tx = (event.target as IDBOpenDBRequest).transaction

      if (!db.objectStoreNames.contains(STORES.TOPICS)) {
        const topicStore = db.createObjectStore(STORES.TOPICS, {
          keyPath: 'id'
        })
        topicStore.createIndex('title', 'title', { unique: true })
      }

      if (!db.objectStoreNames.contains(STORES.CARDS)) {
        const cardStore = db.createObjectStore(STORES.CARDS, { keyPath: 'id' })
        cardStore.createIndex('topicId', 'topicId', { unique: false })
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

      // v3: queue items may gain opId/attempts/nextRetryAt — no schema change needed
      // v4: user settings stores
      void tx
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function withTransaction<T>(
  storeNames: string[] | string,
  mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => Promise<T>
): Promise<T> {
  const db = await openDatabase()
  const storeList = Array.isArray(storeNames) ? storeNames : [storeNames]
  const transaction = db.transaction(storeList, mode)

  const stores: Record<string, IDBObjectStore> = {}
  for (const name of storeList) {
    stores[name] = transaction.objectStore(name)
  }

  return new Promise((resolve, reject) => {
    let result: T

    transaction.oncomplete = () => {
      resolve(result)
    }

    transaction.onabort = () => {
      reject(transaction.error || new Error('Transaction aborted'))
    }

    transaction.onerror = () => {
      reject(transaction.error || new Error('Unknown transaction error'))
    }

    callback(stores)
      .then(res => {
        result = res
      })
      .catch(err => {
        transaction.abort()
        reject(err)
      })
  })
}
