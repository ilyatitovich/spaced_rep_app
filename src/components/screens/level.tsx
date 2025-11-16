import { Button, Content } from '@/components'
import { Card } from '@/models'

type LevelScreenProps = {
  isOpen: boolean
  levelId: string
  cards: Card[]
  onClose: () => void
}

export default function LevelScreen({
  isOpen,
  levelId,
  cards,
  onClose
}: LevelScreenProps) {
  const handleClose = (): void => {
    onClose()
  }

  return (
    <div
      className={`${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      <div className="relative w-full p-4 flex justify-between items-center border-b border-gray-200">
        <Button onClick={handleClose}>Back</Button>
        <span className="font-semibold">
          {Number(levelId) === 0 ? 'Draft' : `Level ${levelId}`}
        </span>
      </div>

      {cards && cards.length > 0 ? (
        <Content height={92} className="flex content-start flex-wrap gap-4">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => console.log('open card id', card.id)}
              className="w-[calc((100%-2em)/3-0.5em)] h-1/5 flex justify-center items-center text-[0.8rem] border-2 border-black rounded-2xl text-black"
            >
              <span className="font-bold">
                {typeof card.data.front === 'string' ? card.data.front : ''}
              </span>
            </button>
          ))}
        </Content>
      ) : (
        <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500">
          No cards
        </p>
      )}
    </div>
  )
}
