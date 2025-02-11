import { Topic } from '@/models'
import type { LevelColor, LevelId, Card } from '@/types'

export function getLevelCards(topicId: string, levelId: LevelId): Card[] {
  const topic: Topic = JSON.parse(localStorage.getItem(topicId)!)

  if (levelId === 'draft') {
    return topic.draft
  } else {
    return topic.levels[Number(levelId) - 1].cards
  }
}

export function getCard(
  topic: Topic,
  levelId: LevelId,
  cardIndx: number
): Card {
  if (levelId === 'draft') {
    return topic.draft[cardIndx]
  } else {
    return topic.levels[Number(levelId) - 1].cards[cardIndx]
  }
}

export const levelColors: LevelColor[] = [
  'red',
  'rgb(21, 255, 0)',
  'rgb(255, 251, 0)',
  'rgb(0, 255, 242)',
  'rgb(0, 89, 255)',
  'rgb(183, 0, 255)',
  'rgb(89, 0, 255)'
]
