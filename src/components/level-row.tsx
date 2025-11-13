import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from 'react-router'

type LevelRowProps = {
  levelId: number
  cardsNumber: number
}

export default function LevelRow({ levelId, cardsNumber }: LevelRowProps) {
  let leftContent = (
    <>
      <span
        className={`inline-block w-2 h-2 rounded-full bg-lvl-${levelId}`}
      ></span>
      <span className="flex flex-col text-black">
        <p>{`Level ${levelId}`}</p>
        <small className="text-gray">
          {levelId === 1
            ? 'Everyday'
            : `Every ${Math.pow(2, levelId) / 2} days`}
        </small>
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
    <li className="py-4 border-b border-light-gray">
      <Link to={`${levelId}`} className="flex justify-between items-center">
        <span className="flex items-center gap-3">{leftContent}</span>
        <span className="flex items-center gap-3 text-gray">
          <span>{`${cardsNumber} cards`}</span>
          <span className="text-sm">
            <FontAwesomeIcon icon={faChevronRight} />
          </span>
        </span>
      </Link>
    </li>
  )
}
