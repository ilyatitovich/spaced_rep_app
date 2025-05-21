import { useLoaderData, useNavigate } from 'react-router'

import { Button, Navbar, CardsListContainer } from '@/components'
import type { Card } from '@/lib/definitions'

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
