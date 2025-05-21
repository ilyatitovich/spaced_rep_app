import { faXmark, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { DayOfWeek } from '../lib/definitions'
import { levelColors } from '../lib/utils'

interface WeekProps {
  week: Array<DayOfWeek | null>
  today: number
}

const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Week({ week, today }: WeekProps) {
  return (
    <div className="flex justify-between week">
      {week.map((day, index) => (
        <span key={index + 10} className="day flex flex-col items-center">
          <small>{letters[index]}</small>

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
          {day &&
            levelColors.map((bgColor, index) => (
              <div
                key={bgColor}
                className="w-2 h-2 rounded-full my-1"
                style={{
                  backgroundColor: day.todayLevels.includes(index)
                    ? bgColor
                    : 'transparent'
                }}
              ></div>
            ))}
        </span>
      ))}
    </div>
  )
}
