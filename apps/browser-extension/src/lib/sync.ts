import { createHttpSyncClient } from '@spaced-rep/sync-client'
import type { Mutation } from '@spaced-rep/sync-protocol'
import { API_URL, freshSession } from './auth'
import {
  getCard,
  getOutbox,
  getTopics,
  removeOutbox,
  setTopics,
  updateOutbox
} from './storage'
import type { Topic } from '../types'

const DEVICE_KEY = 'sync.deviceId'
const WATERMARK_KEY = 'sync.watermark'
const syncClient = createHttpSyncClient({
  apiUrl: API_URL,
  getAccessToken: async () => (await freshSession())?.accessToken ?? null
})

async function deviceId(): Promise<string> {
  const stored = await chrome.storage.local.get(DEVICE_KEY)
  if (typeof stored[DEVICE_KEY] === 'string') return stored[DEVICE_KEY]
  const id = crypto.randomUUID()
  await chrome.storage.local.set({ [DEVICE_KEY]: id })
  return id
}

export async function hasPro(): Promise<boolean> {
  const session = await freshSession()
  if (!session) return false
  const response = await fetch(`${API_URL}/settings/subscription`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  })
  if (!response.ok) return false
  const body = (await response.json()) as {
    data?: { plan: string; status: string; endsAt: number | null }
  }
  const subscription = body.data
  if (!subscription || subscription.plan !== 'pro') return false
  return (
    ['active', 'on_trial', 'past_due'].includes(subscription.status) ||
    (subscription.status === 'canceled' &&
      subscription.endsAt !== null &&
      subscription.endsAt > Date.now())
  )
}

export async function bootstrapTopics(): Promise<Topic[]> {
  if (!(await hasPro())) return []
  const id = await deviceId()
  const stored = await chrome.storage.local.get(WATERMARK_KEY)
  const watermark =
    typeof stored[WATERMARK_KEY] === 'string'
      ? stored[WATERMARK_KEY]
      : new Date(0).toISOString()
  const response = await syncClient.bootstrap(
    id,
    watermark,
    (await getOutbox()).length
  )
  const topics = await getTopics()
  for (const record of response.records) {
    if (!record.topic || record.topic.deletedAt) continue
    const topic: Topic = {
      id: record.topic.id,
      title: record.topic.title,
      pivot: record.topic.pivot,
      week: JSON.parse(record.topic.weekJson) as null[],
      nextUpdateDate: record.topic.nextUpdateDate,
      updatedAt: record.topic.updatedAt,
      deletedAt: null
    }
    const index = topics.findIndex(candidate => candidate.id === topic.id)
    if (index === -1) topics.push(topic)
    else topics[index] = topic
  }
  await setTopics(topics)
  await chrome.storage.local.set({
    [WATERMARK_KEY]: response.watermark
  })
  return topics
}

export async function flushOutbox(): Promise<void> {
  if (!(await hasPro())) return
  const now = Date.now()
  const queue = (await getOutbox()).filter(item => item.nextAttemptAt <= now)
  if (!queue.length) return
  const id = await deviceId()
  const pairs = await Promise.all(
    queue.map(async item => ({ item, card: await getCard(item.cardId) }))
  )
  const mutations: Mutation[] = pairs
    .filter(pair => pair.card)
    .map(({ item, card }) => ({
      opId: item.id,
      deviceId: id,
      table: 'cards',
      recordId: card!.id,
      operation: 'upsert',
      updatedAt: card!.updatedAt,
      card: {
        id: card!.id,
        topicId: card!.topicId,
        level: card!.level,
        dataJson: JSON.stringify(card!.data),
        reviewDate: card!.reviewDate ?? null,
        updatedAt: card!.updatedAt,
        deletedAt: null
      }
    }))
  if (!mutations.length) return
  try {
    const response = await syncClient.push(id, mutations)
    for (const opId of response.acceptedOpIds) {
      await removeOutbox(opId)
    }
    for (const rejected of response.rejected) {
      const item = queue.find(candidate => candidate.id === rejected.opId)
      if (!item) continue
      if (!rejected.retryable) await removeOutbox(item.id)
      else
        await updateOutbox({
          ...item,
          attempts: item.attempts + 1,
          nextAttemptAt: now + Math.min(60 * 60_000, 2 ** item.attempts * 5_000)
        })
    }
  } catch {
    for (const item of queue) {
      await updateOutbox({
        ...item,
        attempts: item.attempts + 1,
        nextAttemptAt: now + Math.min(60 * 60_000, 2 ** item.attempts * 5_000)
      })
    }
  }
}
