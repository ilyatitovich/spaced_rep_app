import { Topic } from '@/models'
import type { LevelColor, LevelId, Card } from '@/types'

import { getTopic } from './db'

export async function getLevelCards(
  topicId: string,
  levelId: LevelId
): Promise<Card[]> {
  const topic = await getTopic(topicId)

  if (!topic) {
    throw new Error('No topic')
  }

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

export function updateVh(prevHeight: number): number {
  const newHeight = window.innerHeight
  if (newHeight !== prevHeight) {
    document.documentElement.style.setProperty('--vh', `${newHeight * 0.01}px`)
  }
  return newHeight
}
