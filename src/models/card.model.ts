import { nanoid } from 'nanoid'

import type { CardData } from '@/types'

export class Card {
  id: string
  topicId: string
  level: number
  data: CardData

  constructor(data: CardData, topicId: string, level: number = 0) {
    this.id = nanoid()
    this.topicId = topicId
    this.level = level
    this.data = data
  }
}
