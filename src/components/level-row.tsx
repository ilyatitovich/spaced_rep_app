import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

type LevelRowProps = {
  levelId: number
  cardsNumber: number
}

export default function LevelRow({ levelId, cardsNumber }: LevelRowProps) {
  let leftContent = (
    <>
      <span className={`w-2 h-2 rounded-full bg-lvl-${levelId}`}></span>
      <span className="flex flex-col text-black">
        <span>{`Level ${levelId}`}</span>
        <span className="text-gray-500 text-sm">
          {levelId === 1
            ? 'Everyday'
            : `Every ${Math.pow(2, levelId) / 2} days`}
        </span>
      </span>
    </>
  )

  if (levelId === 0) {
    leftContent = <span className="flex flex-col">Draft</span>
  }

  if (levelId === 8) {
    leftContent = leftContent = (
      <span className="flex flex-col">Finished cards</span>
    )
  }

  if (levelId === 0 && cardsNumber === 0) {
    return null
  }

  return (
    <li className="py-3.5 border-b border-gray-200 last:border-b-0">
      <Link to={`${levelId}`} className="flex justify-between items-center">
        <span className="flex items-center gap-3 text-lg">{leftContent}</span>
        <span className="flex items-center gap-3 text-gray-500">
          <span className="text-lg">{`${cardsNumber} cards`}</span>
          <ChevronRight className="text-sm" />
        </span>
      </Link>
    </li>
  )
}
