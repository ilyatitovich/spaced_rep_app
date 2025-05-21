import { useLoaderData, useNavigate } from 'react-router'

import { Button, Navbar, CardsListContainer } from '@/components'
import { LevelId, Card } from '@/lib/definitions'

export default function Level() {
  const navigate = useNavigate()
  const { levelId, levelCards } = useLoaderData() as {
    levelId: LevelId
    levelCards: Card[]
  }

  return (
    <main className="level">
      <Navbar>
        <Button onClick={() => navigate(-1)}>Back</Button>
        <h1 className="title">Level {levelId}</h1>
      </Navbar>
      <CardsListContainer cardsFrom="level" cardsList={levelCards} />
    </main>
  )
}
