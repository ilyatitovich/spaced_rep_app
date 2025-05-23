const DB_NAME = 'spacedRepApp'
const DB_VERSION = 1
export const STORES = {
  TOPICS: 'topics',
  CARDS: 'cards'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORES.TOPICS)) {
        const topicStore = db.createObjectStore(STORES.TOPICS, {
          keyPath: 'id'
        })
        topicStore.createIndex('title', 'title', { unique: true })
      }

      if (!db.objectStoreNames.contains(STORES.CARDS)) {
        const cardStore = db.createObjectStore(STORES.CARDS, { keyPath: 'id' })
        cardStore.createIndex('topicId', 'topicId', { unique: false })
        cardStore.createIndex('nextReviewDate', 'nextReviewDate', {
          unique: false
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function withTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDatabase()
  const transaction = db.transaction(storeName, mode)
  const store = transaction.objectStore(storeName)

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

    callback(store)
      .then(res => {
        result = res
      })
      .catch(err => {
        reject(err)
      })
  })
}
