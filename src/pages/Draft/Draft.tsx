import './Draft.scss'

import { LoaderFunctionArgs, useLoaderData, useNavigate } from 'react-router'

import CardsListContainer from '../../components/CardsListContainer/CardsListContainer'
import { Card } from '../../lib/definitions'
import { getLevelCards } from '../../lib/utils'

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
    <div className="draft">
      <nav>
        <button onClick={() => navigate(-1)}>Back</button>
        <p className="title">Draft</p>
      </nav>
      <CardsListContainer cardsFrom="draft" cardsList={draftCards} />
    </div>
  )
}
