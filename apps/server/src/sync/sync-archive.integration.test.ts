import { describe, expect, it } from 'vitest'

import { applyPushBatch } from './sync.service.js'
import {
  getTestPrisma,
  topicFactory,
  userFactory
} from '../../../../testing/index.js'

describe('applyPushBatch topic archive', () => {
  it('sets is_archived on an existing topic via upsert update', async () => {
    const user = await userFactory.create()
    const deviceId = crypto.randomUUID()
    const topic = await topicFactory.create({
      userId: user.id,
      isArchived: false,
      updatedAt: new Date(1_700_000_000_000)
    })

    const ack = await applyPushBatch({
      userId: user.id,
      deviceId,
      mutations: [
        {
          opId: crypto.randomUUID(),
          deviceId,
          table: 'topics',
          recordId: topic.id,
          operation: 'upsert',
          updatedAt: 1_700_000_100_000,
          topic: {
            id: topic.id,
            title: topic.title,
            pivot: Number(topic.pivot),
            weekJson: JSON.stringify(topic.week ?? []),
            nextUpdateDate: Number(topic.nextUpdateDate),
            isArchived: true,
            updatedAt: 1_700_000_100_000,
            deletedAt: null
          }
        }
      ]
    })

    expect(ack.acceptedOpIds).toHaveLength(1)

    const row = await getTestPrisma().topic.findUniqueOrThrow({
      where: { id: topic.id }
    })
    expect(row.isArchived).toBe(true)
  })
})
