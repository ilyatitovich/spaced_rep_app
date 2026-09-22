import { createHttpSyncClient } from '@spaced-rep/sync-client'
import type { MediaDBRecord, Mutation } from '@spaced-rep/sync-protocol'
import {
  mergePreparedMedia,
  prepareWireCardData,
  uploadOwnedMedia,
  type MediaDownloadPlanItem,
  type MediaUploadPlanItem,
  type SyncMediaApi
} from '../../../client/src/lib/sync-media'
import { API_URL, freshSession } from '../lib/auth'
import { decodeCardData } from '../lib/card-codec'
import { readValue, writeValue } from '../lib/chrome-store'
import { DEVICE_KEY, WATERMARK_KEY } from '../lib/keys'
import type { Topic } from '@/models/topic.model'
import type { Card } from '../types'
import { getCard } from './cards.service'
import {
  getOutbox,
  removeOutbox,
  updateOutbox,
  type OutboxItem
} from './outbox.service'
import { getTopics, setTopics } from './topics.service'

const syncClient = createHttpSyncClient({
  apiUrl: API_URL,
  getAccessToken: async () => (await freshSession())?.accessToken ?? null
})

async function deviceId(): Promise<string> {
  const stored = await readValue(DEVICE_KEY)
  if (typeof stored === 'string') return stored
  const id = crypto.randomUUID()
  await writeValue(DEVICE_KEY, id)
  return id
}

async function postMediaJson<T>(path: string, body: unknown): Promise<T> {
  const session = await freshSession()
  if (!session) throw new Error('Not authenticated')
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const json = (await response.json().catch(() => null)) as {
    data?: T
    error?: { message?: string }
  } | null
  if (!response.ok || json?.data === undefined) {
    throw new Error(json?.error?.message ?? 'Media request failed')
  }
  return json.data
}

const mediaApi: SyncMediaApi = {
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
  const stored = await readValue(WATERMARK_KEY)
  const watermark =
    typeof stored === 'string' ? stored : new Date(0).toISOString()
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
      week: JSON.parse(record.topic.weekJson) as Topic['week'],
      nextUpdateDate: record.topic.nextUpdateDate,
      updatedAt: record.topic.updatedAt,
      deletedAt: null
    }
    const index = topics.findIndex(candidate => candidate.id === topic.id)
    if (index === -1) topics.push(topic)
    else topics[index] = topic
  }
  await setTopics(topics)
  await writeValue(WATERMARK_KEY, response.watermark)
  return topics
}

type OutboxPair = { item: OutboxItem; card?: Card; topic?: Topic }

/** Decode chrome.storage base64 media → wire refs; collect unique buffers for upload. */
export async function buildOutboxMutations(
  deviceIdValue: string,
  pairs: OutboxPair[]
): Promise<{ mutations: Mutation[]; mediaByHash: Map<string, MediaDBRecord> }> {
  const mediaByHash = new Map<string, MediaDBRecord>()
  const mutations: Mutation[] = []
  const ordered = [...pairs].sort((a, b) =>
    a.item.table === b.item.table ? 0 : a.item.table === 'topics' ? -1 : 1
  )

  for (const { item, card, topic } of ordered) {
    if (item.operation === 'delete') {
      mutations.push({
        opId: item.id,
        deviceId: deviceIdValue,
        table: item.table,
        recordId: item.recordId,
        operation: 'delete',
        updatedAt: item.updatedAt
      })
      continue
    }

    if (item.table === 'topics' && topic) {
      mutations.push({
        opId: item.id,
        deviceId: deviceIdValue,
        table: 'topics',
        recordId: item.recordId,
        operation: item.operation,
        updatedAt: topic.updatedAt,
        topic: {
          id: topic.id,
          title: topic.title,
          pivot: topic.pivot,
          weekJson: JSON.stringify(topic.week),
          nextUpdateDate: topic.nextUpdateDate,
          updatedAt: topic.updatedAt,
          deletedAt: null
        }
      })
      continue
    }

    if (!card) continue

    // Decode only for the wire transform — chrome.storage keeps base64 bytes.
    const { wireData, mediaByHash: cardMedia } = await prepareWireCardData(
      decodeCardData(card.data)
    )
    mergePreparedMedia(mediaByHash, cardMedia)
    mutations.push({
      opId: item.id,
      deviceId: deviceIdValue,
      table: 'cards',
      recordId: card.id,
      operation: item.operation,
      updatedAt: card.updatedAt,
      card: {
        id: card.id,
        topicId: card.topicId,
        level: card.level,
        dataJson: JSON.stringify(wireData),
        reviewDate: card.reviewDate ?? null,
        updatedAt: card.updatedAt,
        deletedAt: null
      }
    })
  }

  return { mutations, mediaByHash }
}

export async function flushOutbox(): Promise<void> {
  if (!(await hasPro())) return
  const now = Date.now()
  const queue = (await getOutbox()).filter(item => item.nextAttemptAt <= now)
  if (!queue.length) return
  const id = await deviceId()
  const topics = await getTopics()
  const pairs: OutboxPair[] = []
  for (const item of queue) {
    if (item.operation === 'delete') {
      pairs.push({ item })
      continue
    }
    if (item.table === 'topics') {
      const topic = topics.find(candidate => candidate.id === item.recordId)
      if (!topic) await removeOutbox(item.id)
      else pairs.push({ item, topic })
      continue
    }
    const card = await getCard(item.recordId)
    if (!card) await removeOutbox(item.id)
    else pairs.push({ item, card })
  }
  if (!pairs.length) return

  try {
    const { mutations, mediaByHash } = await buildOutboxMutations(id, pairs)
    // Upload before push so the server can HeadObject refs; failure keeps outbox.
    await uploadOwnedMedia(mediaByHash, mediaApi)
    const response = await syncClient.push(id, mutations)
    for (const opId of response.acceptedOpIds) {
      await removeOutbox(opId)
    }
    for (const rejected of response.rejected) {
      const item = pairs.find(pair => pair.item.id === rejected.opId)?.item
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
    for (const { item } of pairs) {
      await updateOutbox({
        ...item,
        attempts: item.attempts + 1,
        nextAttemptAt: now + Math.min(60 * 60_000, 2 ** item.attempts * 5_000)
      })
    }
  }
}
