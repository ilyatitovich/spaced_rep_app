import './Level.scss'

import { LevelId, Card } from '@/types'
import { useLoaderData, useNavigate } from 'react-router'

import CardsListContainer from '../../components/CardsListContainer/CardsListContainer'

export default function Level() {
  const navigate = useNavigate()
  const { levelId, levelCards } = useLoaderData() as {
    levelId: LevelId
    levelCards: Card[]
  }

  return (
    <div className="level">
      <nav>
        <button onClick={() => navigate(-1)}>Back</button>
        <p className="title">Level {levelId}</p>
      </nav>
      <CardsListContainer cardsFrom="level" cardsList={levelCards} />
    </div>
  )
}
