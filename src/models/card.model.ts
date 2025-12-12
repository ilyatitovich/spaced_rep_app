import type { CardData } from '@/types'

export class Card {
  id: string
  topicId: string
  level: number
  data: CardData
  reviewDate?: number

  constructor(data: CardData, topicId: string, level: number = 0) {
    this.id = crypto.randomUUID()
    this.topicId = topicId
    this.level = level
    this.data = data
  }
}
