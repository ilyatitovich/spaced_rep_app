import { Link } from 'react-router'
import { v4 as uuidv4 } from 'uuid'

import { Card } from '../lib/definitions'
import { Content } from './ui'

type CardsListContainerProps = {
  cardsFrom: 'level' | 'draft'
  cardsList: Card[]
}

export default function CardsListContainer({
  cardsFrom,
  cardsList
}: CardsListContainerProps) {
  const isCards = cardsList.length > 0

  return (
    <Content
      height={92}
      centered={!isCards}
      className="flex content-start flex-wrap gap-4"
    >
      {isCards ? (
        cardsList.map((card: Card, index: number) => (
          <Link
            key={uuidv4()}
            to={cardsFrom === 'draft' ? `${index}/edit` : `${index}`}
            className="w-[calc((100%-2em)/3-0.5em)] h-1/5 flex justify-center items-center text-[0.8rem] border border-black rounded-[0.7em] text-black"
          >
            <small>{card.front}</small>
          </Link>
        ))
      ) : (
        <p>No cards</p>
      )}
    </Content>
  )
}
