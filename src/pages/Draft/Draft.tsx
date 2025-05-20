import './Draft.scss'

import {
  LoaderFunctionArgs,
  useLoaderData,
  useNavigate
} from 'react-router-dom'

import CardsListContainer from '../../components/CardsListContainer/CardsListContainer'
import { Card } from '../../lib/definitions'
import { getLevelCards } from '../../lib/utils'
import { Button, Navbar } from '../../components/ui'

// eslint-disable-next-line react-refresh/only-export-components
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
      <Navbar>
        <Button onClick={() => navigate(-1)}>Back</Button>
        <p className="title">Draft</p>
      </Navbar>
      <CardsListContainer cardsFrom="draft" cardsList={draftCards} />
    </div>
  )
}
