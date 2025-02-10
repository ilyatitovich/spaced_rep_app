import './Draft.scss'

import { useLoaderData, useNavigate } from 'react-router'

import CardsListContainer from '../../components/CardsListContainer/CardsListContainer'
import { Card } from '../../lib/definitions'

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
