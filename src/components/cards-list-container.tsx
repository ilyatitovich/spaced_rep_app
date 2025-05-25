import { nanoid } from 'nanoid'
import { Link } from 'react-router'

import { Content } from './ui'
import { Card } from '@/models'

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
            key={nanoid()}
            to={cardsFrom === 'draft' ? `${index}/edit` : `${index}`}
            className="w-[calc((100%-2em)/3-0.5em)] h-1/5 flex justify-center items-center text-[0.8rem] border border-black rounded-[0.7em] text-black"
          >
            <small>
              {typeof card.data.front === 'string' ? card.data.front : ''}
            </small>
          </Link>
        ))
      ) : (
        <p>No cards</p>
      )}
    </Content>
  )
}
