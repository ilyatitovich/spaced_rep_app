import './LevelRow.scss'

import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from 'react-router'

import { type Level } from '../../lib/definitions'

export default function LevelRow({ level }: { level: Level }) {
  const { id, color, cards } = level

  let leftContent = (
    <>
      <span className="color" style={{ backgroundColor: color }}></span>
      <span className="number">
        <p>{`Level ${id}`}</p>
        <small>
          {id === 1 ? 'Everyday' : `Every ${Math.pow(2, id) / 2} days`}
        </small>
      </span>
    </>
  )

  if (id === 8) {
    leftContent = (
      <span className="number">
        <p>Finished Cards</p>
      </span>
    )
  }

  return (
    <li className="level-row">
      <Link to={`${id}`}>
        <div className="left">{leftContent}</div>
        <div className="right">
          <span>{`${cards.length} cards`}</span>
          <span className="icon">
            <FontAwesomeIcon icon={faChevronRight} />
          </span>
        </div>
      </Link>
    </li>
  )
}
