import { describe, expect, it } from 'vitest'
import type { Mutation } from '@spaced-rep/sync-protocol'
import { mutationProblem, partitionMalformed } from './mutation-validation.js'

const ID = '11111111-1111-4111-8111-111111111111'
const TOPIC_ID = '22222222-2222-4222-8222-222222222222'

function cardUpsert(card: Partial<NonNullable<Mutation['card']>> = {}) {
  return {
    opId: ID,
    deviceId: ID,
    table: 'cards',
    recordId: ID,
    operation: 'upsert',
    updatedAt: 1,
    card: {
      id: ID,
      topicId: TOPIC_ID,
      level: 0,
      dataJson: '{}',
      updatedAt: 1,
      ...card
    }
  } satisfies Mutation
}

function topicUpsert(topic: Partial<NonNullable<Mutation['topic']>> = {}) {
  return {
    opId: ID,
    deviceId: ID,
    table: 'topics',
    recordId: TOPIC_ID,
    operation: 'upsert',
    updatedAt: 1,
    topic: {
      id: TOPIC_ID,
      title: 'Topic',
      pivot: 1,
      weekJson: '[]',
      nextUpdateDate: 1,
      updatedAt: 1,
      ...topic
    }
  } satisfies Mutation
}

describe('mutationProblem', () => {
  it('accepts well-formed upserts and deletes', () => {
    expect(mutationProblem(cardUpsert())).toBeNull()
    expect(mutationProblem(topicUpsert())).toBeNull()
    expect(
      mutationProblem({
        opId: ID,
        deviceId: ID,
        table: 'cards',
        recordId: ID,
        operation: 'delete',
        updatedAt: 5
      })
    ).toBeNull()
  })

  it.each([
    ['a card upsert without a card', { ...cardUpsert(), card: undefined }],
    ['a topic upsert without a topic', { ...topicUpsert(), topic: undefined }],
    [
      'a card upsert carrying only a topic',
      { ...cardUpsert(), card: undefined, topic: topicUpsert().topic }
    ],
    [
      'a card id that differs from recordId',
      { ...cardUpsert(), recordId: TOPIC_ID }
    ],
    [
      'a topic id that differs from recordId',
      { ...topicUpsert(), recordId: ID }
    ],
    ['unparseable card dataJson', cardUpsert({ dataJson: '{nope' })],
    ['unparseable topic weekJson', topicUpsert({ weekJson: '[' })],
    ['a NUL in card text', cardUpsert({ dataJson: '{"a":"\\u0000"}' })],
    ['a NUL in a topic title', topicUpsert({ title: 'a\u0000b' })],
    ['a fractional topic pivot', topicUpsert({ pivot: 1.5 })],
    [
      'a topic date beyond bigint-safe range',
      topicUpsert({ nextUpdateDate: 1e30 })
    ],
    ['a fractional card level', cardUpsert({ level: 1.5 })],
    ['a card level beyond int32', cardUpsert({ level: 2 ** 31 })],
    ['a fractional reviewDate', cardUpsert({ reviewDate: 1.5 })],
    ['an out-of-range updatedAt', { ...cardUpsert(), updatedAt: -1e20 }],
    ['an out-of-range payload updatedAt', cardUpsert({ updatedAt: -1e20 })]
  ] satisfies [string, Mutation][])('flags %s', (_name, mutation) => {
    expect(mutationProblem(mutation)).toEqual(expect.any(String))
  })
})

describe('partitionMalformed', () => {
  it('rejects malformed ops permanently and keeps the rest', () => {
    const bad = { ...cardUpsert({ dataJson: '{nope' }), opId: TOPIC_ID }
    const good = topicUpsert()

    const { valid, rejected } = partitionMalformed([bad, good])

    expect(valid).toEqual([good])
    expect(rejected).toEqual([
      {
        opId: TOPIC_ID,
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        retryable: false
      }
    ])
  })
})
