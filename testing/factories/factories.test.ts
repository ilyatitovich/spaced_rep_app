import { beforeEach, describe, expect, it } from 'vitest'
import { seedFaker } from '../db/seed.js'
import { cardFactory, topicFactory, userFactory } from './index.js'

describe('factory build helpers', () => {
  beforeEach(() => {
    seedFaker(42)
  })

  it('userFactory.build returns a lowercased email', () => {
    const user = userFactory.build()
    expect(user.email).toMatch(/@/)
    expect(user.email).toBe(user.email.toLowerCase())
    expect(user.emailVerifiedAt).toBeInstanceOf(Date)
  })

  it('userFactory.build applies overrides', () => {
    const user = userFactory.build({
      email: 'fixed@example.com',
      emailVerifiedAt: null
    })
    expect(user.email).toBe('fixed@example.com')
    expect(user.emailVerifiedAt).toBeNull()
  })

  it('topicFactory.build applies userId override', () => {
    const topic = topicFactory.build({ userId: 'user-1', title: 'Spanish' })
    expect(topic.userId).toBe('user-1')
    expect(topic.title).toBe('Spanish')
    expect(typeof topic.pivot).toBe('bigint')
  })

  it('cardFactory.build returns card payload defaults', () => {
    const card = cardFactory.build({ topicId: 'topic-1', userId: 'user-1' })
    expect(card.topicId).toBe('topic-1')
    expect(card.userId).toBe('user-1')
    expect(card.level).toBe(0)
    expect(card.data).toEqual({ front: {}, back: {} })
  })

  it('seedFaker produces deterministic emails', () => {
    seedFaker(42)
    const first = userFactory.build().email
    seedFaker(42)
    const second = userFactory.build().email
    expect(first).toBe(second)
  })
})
