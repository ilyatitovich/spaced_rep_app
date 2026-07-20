import type {
  Card,
  Prisma
} from '../../apps/server/src/generated/prisma/client.js'
import { getTestPrisma } from '../db/prisma.js'

export type CardBuildInput = {
  id: string
  userId: string
  topicId: string
  level: number
  data: Prisma.InputJsonValue
  reviewDate: bigint | null
  updatedAt: Date
  deletedAt: Date | null
}

export const cardFactory = {
  build(overrides: Partial<CardBuildInput> = {}): CardBuildInput {
    const now = Date.now()

    return {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      topicId: crypto.randomUUID(),
      level: 0,
      data: { front: {}, back: {} },
      reviewDate: null,
      updatedAt: new Date(now),
      deletedAt: null,
      ...overrides
    }
  },

  async create(overrides: Partial<CardBuildInput> = {}): Promise<Card> {
    const data = cardFactory.build(overrides)
    const prisma = getTestPrisma()

    return prisma.card.create({
      data: {
        id: data.id,
        userId: data.userId,
        topicId: data.topicId,
        level: data.level,
        data: data.data,
        reviewDate: data.reviewDate,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt
      }
    })
  }
}
