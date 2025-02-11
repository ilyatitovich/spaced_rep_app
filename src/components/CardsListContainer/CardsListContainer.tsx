import './CardsListContainer.scss'

import { Card } from '@/types'
import { Link } from 'react-router'

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
            key={card.id}
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
