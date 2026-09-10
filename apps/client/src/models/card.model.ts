import type { LegacyCardData } from '@/types'

export class Card {
  id: string
  topicId: string
  level: number
  data: LegacyCardData
  reviewDate?: number
  updatedAt: number

  constructor(data: LegacyCardData, topicId: string, level: number = 0) {
    this.id = crypto.randomUUID()
    this.topicId = topicId
    this.level = level
    this.data = data
    this.updatedAt = Date.now()
  }
}
