import './Draft.scss'

import { CardsListContainer } from '@/components'
import type { Card } from '@/types'
import { useLoaderData, useNavigate } from 'react-router'

export default function Draft() {
  const navigate = useNavigate()
  const { draftCards } = useLoaderData() as {
    draftCards: Card[]
  }

  return (
    <div className="draft">
      <nav>
        <button onClick={() => navigate(-1)}>Back</button>
        <p className="title">Draft</p>
      </nav>
      <CardsListContainer cardsFrom="draft" cardsList={draftCards} />
    </div>
  )
}
