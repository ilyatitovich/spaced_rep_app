import './CardsListContainer.scss'

import { Link } from 'react-router'
import { v4 as uuidv4 } from 'uuid'

import { Card } from '../../lib/definitions'

interface CardsListContainerProps {
  cardsFrom: 'level' | 'draft'
  cardsList: Card[]
}

export default function CardsListContainer({
  cardsFrom,
  cardsList
}: CardsListContainerProps) {
  return (
    <div className="cards-list">
      {cardsList.length > 0 ? (
        cardsList.map((card: Card, index: number) => (
          <Link
            key={uuidv4()}
            to={cardsFrom === 'draft' ? `${index}/edit` : `${index}`}
            className="card"
          >
            <small>{card.front}</small>
          </Link>
        ))
      ) : (
        <div className="message">No cards</div>
      )}
    </div>
  )
}
