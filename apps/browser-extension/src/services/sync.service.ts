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
import { API_URL, freshSession } from './auth'
import { decodeCardData } from './card-codec'
import { readValue, writeValue } from './chrome-store'
import { DEVICE_KEY, WATERMARK_KEY } from './keys'
import { getCard } from '../services/cards.service'
import {
  getOutbox,
  removeOutbox,
  updateOutbox,
  type OutboxItem
} from '../services/outbox.service'
import { getTopics, setTopics } from '../services/topics.service'
import type { Card, Topic } from '../types'

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
  await writeValue(WATERMARK_KEY, response.watermark)
  return topics
}

/** Decode chrome.storage base64 media → wire refs; collect unique buffers for upload. */
export async function buildOutboxMutations(
  deviceIdValue: string,
  pairs: { item: OutboxItem; card: Card }[]
): Promise<{ mutations: Mutation[]; mediaByHash: Map<string, MediaDBRecord> }> {
  const mediaByHash = new Map<string, MediaDBRecord>()
  const mutations: Mutation[] = []

  for (const { item, card } of pairs) {
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
      operation: 'upsert',
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
  const pairs = (
    await Promise.all(
      queue.map(async item => ({ item, card: await getCard(item.cardId) }))
    )
  ).filter(
    (pair): pair is { item: (typeof queue)[number]; card: NonNullable<typeof pair.card> } =>
      Boolean(pair.card)
  )
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
