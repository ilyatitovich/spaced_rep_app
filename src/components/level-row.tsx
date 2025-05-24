import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from 'react-router'

import { Level } from '../lib/helpers'

export default function LevelRow({ level }: { level: Level }) {
  const { id, cards } = level

  let leftContent = (
    <>
      <span className={`inline-block w-2 h-2 rounded-full bg-lvl-${id}`}></span>
      <span className="flex flex-col text-black">
        <p>{`Level ${id}`}</p>
        <small className="text-gray">
          {id === 1 ? 'Everyday' : `Every ${Math.pow(2, id) / 2} days`}
        </small>
      </span>
    </>
  )

  if (id === 0) {
    leftContent = <span className="flex flex-col">Draft</span>
  }

  if (id === 8) {
    leftContent = leftContent = (
      <span className="flex flex-col">Finished cards</span>
    )
  }

  return (
    <li className="py-4 border-b border-light-gray">
      <Link to={`${id}`} className="flex justify-between items-center">
        <span className="flex items-center gap-3">{leftContent}</span>
        <span className="flex items-center gap-3 text-gray">
          <span>{`${cards.length} cards`}</span>
          <span className="text-sm">
            <FontAwesomeIcon icon={faChevronRight} />
          </span>
        </span>
      </Link>
    </li>
  )
}
