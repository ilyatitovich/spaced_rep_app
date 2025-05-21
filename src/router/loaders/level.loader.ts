import type { LoaderFunctionArgs } from 'react-router'

import type { LevelId } from '@/lib/definitions'
import { getLevelCards } from '@/lib/utils'

export async function levelLoader({ params }: LoaderFunctionArgs) {
  const levelId = params.levelId as LevelId
  const levelCards = getLevelCards(params.topicId!, levelId)
  return { levelId, levelCards }
}
