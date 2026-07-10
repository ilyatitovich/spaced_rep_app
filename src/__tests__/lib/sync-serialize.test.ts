import {
  cardToRow,
  rowToCard,
  rowToTopic,
  shouldApplyRemote,
  topicToRow
} from '@/lib/sync-serialize'
import { Card, Topic } from '@/models'
import type { CardData } from '@/types'

const USER_ID = 'user-123'

function textData(front: string, back: string): CardData {
  return {
    front: { side: 'front', type: 'text', content: front },
    back: { side: 'back', type: 'text', content: back }
  }
}

describe('sync-serialize', () => {
  describe('topic round-trip', () => {
    it('preserves core fields through row conversion', () => {
      const topic = new Topic('Spanish')
      const row = topicToRow(topic, USER_ID)

      expect(row.user_id).toBe(USER_ID)
      expect(row.title).toBe('Spanish')
      expect(row.pivot).toBe(topic.pivot)

      const restored = rowToTopic(row)
      expect(restored.id).toBe(topic.id)
      expect(restored.title).toBe(topic.title)
      expect(restored.pivot).toBe(topic.pivot)
      expect(restored.nextUpdateDate).toBe(topic.nextUpdateDate)
      expect(restored.updatedAt).toBe(topic.updatedAt)
    })
  })

  describe('card round-trip', () => {
    it('preserves a text card', () => {
      const card = new Card(textData('Hola', 'Hello'), 'topic-1', 2)
      const restored = rowToCard(cardToRow(card, USER_ID))

      expect(restored.id).toBe(card.id)
      expect(restored.topicId).toBe('topic-1')
      expect(restored.level).toBe(2)
      expect(restored.data).toEqual(card.data)
      expect(restored.updatedAt).toBe(card.updatedAt)
    })

    it('preserves a code card', () => {
      const data: CardData = {
        front: { side: 'front', type: 'text', content: 'Question' },
        back: {
          side: 'back',
          type: 'code',
          content: { lang: 'js', code: 'const x = 1' }
        }
      }
      const card = new Card(data, 'topic-1', 1)

      expect(rowToCard(cardToRow(card, USER_ID)).data).toEqual(data)
    })

    it('round-trips an image card through base64', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 250, 251, 252])
      const data: CardData = {
        front: {
          side: 'front',
          type: 'image',
          content: { buffer: bytes.buffer, type: 'image/webp' }
        },
        back: { side: 'back', type: 'text', content: 'answer' }
      }
      const card = new Card(data, 'topic-1', 1)

      const row = cardToRow(card, USER_ID)
      const encoded = row.data.front.content as unknown as { buffer: string }
      expect(typeof encoded.buffer).toBe('string')

      const restored = rowToCard(row)
      const restoredContent = restored.data.front.content as {
        buffer: ArrayBuffer
        type: string
      }
      expect(restoredContent.type).toBe('image/webp')
      expect(new Uint8Array(restoredContent.buffer)).toEqual(bytes)
    })

    it('carries reviewDate as review_date', () => {
      const card = new Card(textData('a', 'b'), 'topic-1', 3)
      card.reviewDate = 1_700_000_000_000

      const row = cardToRow(card, USER_ID)
      expect(row.review_date).toBe(1_700_000_000_000)
      expect(rowToCard(row).reviewDate).toBe(1_700_000_000_000)
    })
  })

  describe('shouldApplyRemote (last-write-wins)', () => {
    it('applies when there is no local record', () => {
      expect(shouldApplyRemote(undefined, 100)).toBe(true)
    })

    it('applies when remote is newer', () => {
      expect(shouldApplyRemote(100, 200)).toBe(true)
    })

    it('skips when remote is older', () => {
      expect(shouldApplyRemote(200, 100)).toBe(false)
    })

    it('skips when timestamps are equal', () => {
      expect(shouldApplyRemote(150, 150)).toBe(false)
    })
  })
})
