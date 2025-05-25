import { nanoid } from 'nanoid'
import { useParams, useNavigate, Link } from 'react-router'

import { Button, Navbar, Content } from '@/components'
import { useTopicStore } from '@/stores'

export default function LevelPage() {
  const navigate = useNavigate()
  const { levelId } = useParams()
  const cards = useTopicStore(state => state.getLevelCards(Number(levelId)))
  const isCards = cards.length > 0

  return (
    <main className="level">
      <Navbar>
        <Button onClick={() => navigate(-1)}>Back</Button>
        <h1 className="font-bold">
          {Number(levelId) === 0 ? 'Draft' : `Level ${levelId}`}
        </h1>
      </Navbar>
      <Content
        height={92}
        centered={!isCards}
        className="flex content-start flex-wrap gap-4"
      >
        {isCards ? (
          cards.map((card, i) => (
            <Link
              key={nanoid()}
              to={`${i}/edit`}
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
    </main>
  )
}
