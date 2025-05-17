import type { LoaderFunctionArgs } from 'react-router'

import { getTopic, getTopicsList } from '@/lib/db'
import { getCard, getLevelCards } from '@/lib/utils'
import { Topic } from '@/models'
import type { LevelId, TopicItem } from '@/types'

export async function homeLoader(): Promise<{ topics: TopicItem[] }> {
  return { topics: await getTopicsList() }
}

export async function topicLoader({
  params
}: LoaderFunctionArgs): Promise<{ topic: Topic; today: number }> {
  const topicId = params.topicId
  if (!topicId) {
    throw new Error('Topic ID is required')
  }

  const topic = await getTopic(topicId)
  if (!topic) {
    throw new Error('No topic to review')
  }

  const today = new Date().getDay()

  // Update week if the update day has passed
  if (topic.nextUpdateDate && topic.nextUpdateDate <= Date.now()) {
    topic.updateWeek()
  }

  return { topic, today }
}

export async function testLoader({
  params
}: LoaderFunctionArgs): Promise<{ topic: Topic; today: number }> {
  const topic = await getTopic(params.topicId!)
  if (!topic) {
    throw new Error('No topic in DB')
  }

  const today = new Date().getDay()
  return { topic, today }
}

export async function newCardLoader({ params }: LoaderFunctionArgs) {
  const topic = await getTopic(params.topicId!)
  return { topic }
}

export async function levelLoader({ params }: LoaderFunctionArgs) {
  const { levelId, topicId } = params

  if (!levelId || !topicId) {
    throw new Error('Level ID and topic ID are required')
  }

  const levelCards = await getLevelCards(topicId, levelId as LevelId)

  return { levelId, levelCards }
}

export async function editDraftCardLoader({ params }: LoaderFunctionArgs) {
  const { cardIndx, topicId } = params as { cardIndx: string; topicId: string }

  const topic = await getTopic(topicId)
  const card = getCard(topic!, 'draft', Number(cardIndx))

  return { cardIndx, topic, card }
}

export async function draftLoader({ params }: LoaderFunctionArgs) {
  const draftCards = getLevelCards(params.topicId!, 'draft')
  return { draftCards }
}

export async function cardDetailsLoader({ params }: LoaderFunctionArgs) {
  const { levelId, cardIndx, topicId } = params as {
    levelId: LevelId
    cardIndx: string
    topicId: string
  }

  const topic = await getTopic(topicId)
  const card = getCard(topic!, levelId, Number(cardIndx))

  return { levelId, cardIndx, topic, card }
}
