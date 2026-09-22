import { useCallback, useState } from 'react'

import { getCards } from '../services/cards.service'
import type { Card } from '../types'

export function useCards() {
  const [cards, setCards] = useState<Card[]>([])

  const refresh = useCallback(async () => {
    const next = await getCards()
    setCards(next)
    return next
  }, [])

  return { cards, savedCount: cards.length, refresh }
}
