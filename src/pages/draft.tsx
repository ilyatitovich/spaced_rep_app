import { LoaderFunctionArgs, useLoaderData, useNavigate } from 'react-router'

import CardsListContainer from '../components/cards-list-container'
import { Button, Navbar } from '../components/ui'
import { Card } from '../lib/definitions'
import { getLevelCards } from '../lib/utils'

export async function loader({ params }: LoaderFunctionArgs) {
  const draftCards = getLevelCards(params.topicId!, 'draft')
  return { draftCards }
}

export default function Draft() {
  const navigate = useNavigate()
  const { draftCards } = useLoaderData() as {
    draftCards: Card[]
  }

  return (
    <main>
      <Navbar>
        <Button onClick={() => navigate(-1)}>Back</Button>
        <h1 className="title">Draft</h1>
      </Navbar>
      <CardsListContainer cardsFrom="draft" cardsList={draftCards} />
    </main>
  )
}
