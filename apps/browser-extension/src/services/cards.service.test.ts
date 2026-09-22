import { emptyCardData } from '../lib/card-codec'
import { CARDS_KEY } from '../lib/keys'
import type { Card } from '../types'
import { deleteCards, getCard, saveCard, updateCard } from './cards.service'
import { getOutbox } from './outbox.service'

const values: Record<string, unknown> = {}

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key]
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) =>
          Object.assign(values, next),
        remove: async (key: string | string[]) => {
          for (const k of Array.isArray(key) ? key : [key]) delete values[k]
        }
      }
    }
  } as unknown as typeof chrome
})

describe('updateCard', () => {
  it('preserves the id and re-encodes media', async () => {
    const created = emptyCardData()
    created.front.blocks = [{ type: 'text', html: 'old' }]
    const card = await saveCard(created, 'topic-1')

    const next = emptyCardData()
    next.front.blocks = [{ type: 'text', html: '<b>Updated</b>' }]
    next.back.blocks = [
      {
        type: 'image',
        content: {
          buffer: Uint8Array.from([1, 2, 3]).buffer,
          type: 'image/png'
        }
      }
    ]

    const updated = await updateCard(card.id, next)

    expect(updated?.id).toBe(card.id)
    expect(updated?.topicId).toBe('topic-1')
    expect(updated?.data).toEqual({
      front: {
        side: 'front',
        blocks: [{ type: 'text', html: '<b>Updated</b>' }]
      },
      back: {
        side: 'back',
        blocks: [
          {
            type: 'image',
            content: { buffer: 'AQID', type: 'image/png' }
          }
        ]
      }
    })
    const stored = (values[CARDS_KEY] as Card[])[0]
    expect(stored?.id).toBe(card.id)
    expect(stored?.data).toEqual(updated?.data)
  })
})

describe('deleteCards', () => {
  it('removes a never-pushed card and its pending upsert', async () => {
    const card = await saveCard(emptyCardData(), 'topic-1', true)
    expect(await getOutbox()).toHaveLength(1)

    await deleteCards([card.id])

    expect(await getCard(card.id)).toBeUndefined()
    expect(await getOutbox()).toEqual([])
  })

  it('enqueues a delete for a synced card', async () => {
    const card = await saveCard(emptyCardData(), 'topic-1')

    await deleteCards([card.id])

    expect(await getCard(card.id)).toBeUndefined()
    expect(await getOutbox()).toEqual([
      expect.objectContaining({
        table: 'cards',
        recordId: card.id,
        operation: 'delete'
      })
    ])
  })
})
