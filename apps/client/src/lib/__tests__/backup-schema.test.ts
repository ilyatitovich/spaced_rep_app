import { describe, expect, it } from 'vitest'

import { BackupFileSchema } from '@/lib/backup-schema'

const validTopic = {
  id: 'legacy-nanoid',
  title: 'Spanish',
  pivot: 1,
  week: [],
  nextUpdateDate: 2,
  updatedAt: 1,
  deletedAt: null
}

const validCard = {
  id: 'card-1',
  topicId: 'legacy-nanoid',
  level: 0,
  data: {
    front: { side: 'front', blocks: [] },
    back: { side: 'back', blocks: [] }
  },
  updatedAt: 1
}

describe('BackupFileSchema', () => {
  it('accepts a well-formed backup envelope', () => {
    const result = BackupFileSchema.safeParse({
      version: 1,
      topics: [validTopic],
      cards: [validCard]
    })
    expect(result.success).toBe(true)
  })

  it('rejects when topics or cards are missing or the wrong type', () => {
    expect(
      BackupFileSchema.safeParse({ topics: 'nope', cards: [] }).success
    ).toBe(false)
    expect(
      BackupFileSchema.safeParse({ topics: [], cards: null }).success
    ).toBe(false)
    expect(BackupFileSchema.safeParse({ topics: [] }).success).toBe(false)
    expect(
      BackupFileSchema.safeParse({
        topics: [{ ...validTopic, pivot: 'bad' }],
        cards: []
      }).success
    ).toBe(false)
  })
})
