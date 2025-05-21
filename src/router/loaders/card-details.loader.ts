import type { LoaderFunctionArgs } from 'react-router'

import type { Topic, LevelId, Card as CardType } from '@/lib/definitions'
import { getTopic, getCard } from '@/lib/utils'

export async function cardDetailsLoader({ params }: LoaderFunctionArgs) {
  const { levelId, cardIndx } = params as {
    levelId: LevelId
    cardIndx: string
  }
  const topic: Topic = getTopic(params.topicId!)
  const card: CardType = getCard(topic, levelId, Number(params.cardIndx))
  return { levelId, cardIndx, topic, card }
}
