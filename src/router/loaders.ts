import { getTopic, getTopicsList } from '@/lib/db'
import { getCard, getLevelCards, updateWeek } from '@/lib/utils'
import type { LevelId, TopicItem } from '@/types'
import type { LoaderFunctionArgs } from 'react-router'

export async function homeLoader(): Promise<{ topics: TopicItem[] }> {
  return { topics: await getTopicsList() }
}

export async function topicLoader({ params }: LoaderFunctionArgs) {
  let topic = await getTopic(params.topicId!)
  const today: number = new Date().getDay()

  // update week if update day has passed
  if (topic && topic.nextUpdateDate <= Date.now()) {
    topic = updateWeek(topic)
  }

  return { topic, today }
}

export async function testLoader({ params }: LoaderFunctionArgs) {
  const topic = await getTopic(params.topicId!)
  const today: number = new Date().getDay()
  return { topic, today }
}

export async function newCardLoader({ params }: LoaderFunctionArgs) {
  const topic = await getTopic(params.topicId!)
  return { topic }
}

export async function levelLoader({ params }: LoaderFunctionArgs) {
  const levelId = params.levelId as LevelId
  const levelCards = getLevelCards(params.topicId!, levelId)
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
