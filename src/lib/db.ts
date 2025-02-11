import { Topic } from '@/models'

import type { TopicItem } from '../types'

const DB_NAME = 'spacedRepApp'
const STORE_NAME = 'topics'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveTopic(topic: Topic): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  store.put(topic)
}

export async function getTopicsList(): Promise<TopicItem[]> {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readonly')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.getAll()

    request.onsuccess = () => {
      const topics = request.result as Topic[]
      resolve(topics.map(({ id, title }) => ({ id, title })))
    }

    request.onerror = () => reject(request.error)
  })
}

export async function getTopic(id: string): Promise<Topic | null> {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readonly')
  const store = transaction.objectStore(STORE_NAME)

  const request = store.get(id)

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const data = request.result
      if (!data) return resolve(null)

      // Reconstruct Topic instance
      const topic = Object.assign(new Topic(data.title), data)
      resolve(topic)
    }

    request.onerror = () => reject(request.error)
  })
}

export async function deleteTopic(id: string): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
