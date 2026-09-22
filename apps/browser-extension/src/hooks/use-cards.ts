import { useCallback, useState } from 'react'

import { deleteCards, getCards } from '../services/cards.service'
import { flushOutbox } from '../services/sync.service'
import type { Card } from '../types'

export function useCards() {
  const [cards, setCards] = useState<Card[]>([])

  const refresh = useCallback(async () => {
    const next = await getCards()
    setCards(next)
    return next
  }, [])

  const remove = useCallback(
    async (ids: string[]) => {
      await deleteCards(ids)
      await flushOutbox()
      await refresh()
    },
    [refresh]
  )

  return { cards, savedCount: cards.length, refresh, remove }
}
