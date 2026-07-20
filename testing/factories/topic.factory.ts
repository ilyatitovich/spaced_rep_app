import { faker } from '@faker-js/faker'
import type {
  Prisma,
  Topic
} from '../../apps/server/src/generated/prisma/client.js'
import { getTestPrisma } from '../db/prisma.js'

export type TopicBuildInput = {
  id: string
  userId: string
  title: string
  pivot: bigint
  week: Prisma.InputJsonValue
  nextUpdateDate: bigint
  updatedAt: Date
  deletedAt: Date | null
}

export const topicFactory = {
  build(overrides: Partial<TopicBuildInput> = {}): TopicBuildInput {
    const now = Date.now()

    return {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      title: faker.lorem.words({ min: 1, max: 3 }),
      pivot: BigInt(now),
      week: [],
      nextUpdateDate: BigInt(now + 86_400_000),
      updatedAt: new Date(now),
      deletedAt: null,
      ...overrides
    }
  },

  async create(overrides: Partial<TopicBuildInput> = {}): Promise<Topic> {
    const data = topicFactory.build(overrides)
    const prisma = getTestPrisma()

    return prisma.topic.create({
      data: {
        id: data.id,
        userId: data.userId,
        title: data.title,
        pivot: data.pivot,
        week: data.week,
        nextUpdateDate: data.nextUpdateDate,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt
      }
    })
  }
}
