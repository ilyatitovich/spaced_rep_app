import { LoaderFunctionArgs, useLoaderData, useNavigate } from 'react-router'

import CardsListContainer from '../components/cards-list-container'
import { Button, Navbar } from '../components/ui'
import { LevelId, Card } from '../lib/definitions'
import { getLevelCards } from '../lib/utils'

export async function loader({ params }: LoaderFunctionArgs) {
  const levelId = params.levelId as LevelId
  const levelCards = getLevelCards(params.topicId!, levelId)
  return { levelId, levelCards }
}

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
