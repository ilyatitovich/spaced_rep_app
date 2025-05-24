import { faXmark, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'

import { Day } from '@/lib/helpers'

type WeekProps = {
  week: Array<Day | null>
  today: number
}

const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Week({ week, today }: WeekProps) {
  return (
    <div className="flex justify-between week">
      {week.map((day, index) => (
        <span key={nanoid()} className="day flex flex-col items-center">
          <small>{letters[index]}</small>

          {/* status */}
          <div className="flex items-center justify-center h-6 w-6 my-2 border rounded-full">
            {day ? (
              index < today ? (
                <FontAwesomeIcon
                  icon={day.isDone ? faCheck : faXmark}
                  className={day.isDone ? 'text-green' : 'text-red'}
                />
              ) : (
                <div
                  className={`h-3 w-3 rounded-full ${today === index ? 'bg-purple' : 'bg-transparent'}`}
                ></div>
              )
            ) : (
              <div className="h-3 w-3 rounded-full bg-gray"></div>
            )}
          </div>

          {/* levels */}
          {day &&
            new Array(7)
              .fill(null)
              .map((_, i) => (
                <div
                  key={nanoid()}
                  className={`w-2 h-2 rounded-full my-1 ${day.todayLevels.includes(i + 1) ? `bg-lvl-${i + 1}` : 'bg-transparent'}`}
                ></div>
              ))}
        </span>
      ))}
    </div>
  )
}
