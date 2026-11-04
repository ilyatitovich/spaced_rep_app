import {
  MAX_CURSOR_LENGTH,
  MAX_PUSH_MUTATIONS,
  PullDeltaSchema,
  PushBatchSchema,
  PullRequestSchema,
  type Mutation
} from './index.js'

const ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

function cardUpsert(overrides: Partial<Mutation> = {}): Mutation {
  return {
    opId: ID,
    deviceId: ID,
    table: 'cards',
    recordId: OTHER_ID,
    operation: 'upsert',
    updatedAt: 1,
    card: {
      id: OTHER_ID,
      topicId: ID,
      level: 0,
      dataJson: '{}',
      updatedAt: 1
    },
    ...overrides
  }
}

describe('push mutation ids', () => {
  it('accepts a well-formed mutation', () => {
    expect(
      PushBatchSchema.safeParse({ mutations: [cardUpsert()] }).success
    ).toBe(true)
  })

  it.each([
    ['opId', { opId: 'op-1' }],
    ['deviceId', { deviceId: 'device-1' }],
    ['recordId', { recordId: 'not-a-uuid' }]
  ])('rejects a non-uuid %s', (_field, overrides) => {
    const result = PushBatchSchema.safeParse({
      mutations: [cardUpsert(overrides)]
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid ids inside the record payload', () => {
    const base = cardUpsert()
    const card = base.card
    if (!card) throw new Error('fixture must carry a card')

    for (const patch of [{ id: 'c1' }, { topicId: 't1' }]) {
      const result = PushBatchSchema.safeParse({
        mutations: [{ ...base, card: { ...card, ...patch } }]
      })
      expect(result.success).toBe(false)
    }
  })
})

describe('push batch size', () => {
  it('accepts exactly the maximum and rejects one more', () => {
    const batch = (n: number) => ({
      mutations: Array.from({ length: n }, () => cardUpsert())
    })
    expect(PushBatchSchema.safeParse(batch(MAX_PUSH_MUTATIONS)).success).toBe(
      true
    )
    expect(
      PushBatchSchema.safeParse(batch(MAX_PUSH_MUTATIONS + 1)).success
    ).toBe(false)
  })
})

describe('pull cursor length', () => {
  it('rejects an oversized cursor', () => {
    expect(PullRequestSchema.safeParse({ since: '0' }).success).toBe(true)
    expect(
      PullRequestSchema.safeParse({ since: '1'.repeat(MAX_CURSOR_LENGTH + 1) })
        .success
    ).toBe(false)
  })
})

describe('server-to-client records stay lenient', () => {
  it('decodes a card tombstone with an empty topicId (fanout delete)', () => {
    const result = PullDeltaSchema.safeParse({
      watermark: '',
      more: false,
      records: [
        {
          card: {
            id: OTHER_ID,
            topicId: '',
            level: 0,
            dataJson: '{}',
            updatedAt: 1,
            deletedAt: 1
          }
        }
      ]
    })
    expect(result.success).toBe(true)
  })
})
