import type { LoaderFunctionArgs } from 'react-router'

import { getLevelCards } from '@/lib/utils'

export async function draftLoader({ params }: LoaderFunctionArgs) {
  const draftCards = getLevelCards(params.topicId!, 'draft')
  return { draftCards }
}
