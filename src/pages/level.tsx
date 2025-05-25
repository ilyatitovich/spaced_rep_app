import { useParams, useNavigate } from 'react-router'

import { Button, Navbar, CardsListContainer } from '@/components'
import { useTopicStore } from '@/stores'

export default function LevelPage() {
  const navigate = useNavigate()
  const { levelId } = useParams()

  const levelCards = useTopicStore(state =>
    state.getLevelCards(Number(levelId))
  )

  return (
    <main className="level">
      <Navbar>
        <Button onClick={() => navigate(-1)}>Back</Button>
        <h1 className="title">
          {' '}
          {Number(levelId) === 0 ? 'Draft' : `Level ${levelId}`}
        </h1>
      </Navbar>
      <CardsListContainer cardsFrom="level" cardsList={levelCards} />
    </main>
  )
}
