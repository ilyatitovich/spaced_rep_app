import type { LoaderFunctionArgs } from 'react-router'

import type { Topic, Card as CardType } from '@/lib/definitions'
import { getCard, getTopic } from '@/lib/utils'

export async function editDraftCardLoader({ params }: LoaderFunctionArgs) {
  const { cardIndx } = params as {
    cardIndx: string
  }
  const topic: Topic = getTopic(params.topicId!)
  const card: CardType = getCard(topic, 'draft', Number(cardIndx))
  return { cardIndx, topic, card }
}
