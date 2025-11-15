import { Check, X } from 'lucide-react'

import { getToday } from '@/lib'
import { Day } from '@/lib/helpers'

type WeekProps = {
  week: Array<Day | null>
}

const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Week({ week }: WeekProps) {
  return (
    <div className="flex justify-between week">
      {week.map((day, index) => (
        <span key={index} className="day flex flex-col items-center">
          <small className={day ? 'text-black' : 'text-gray-300'}>
            {letters[index]}
          </small>

          {/* status */}
          {day
            ? index < getToday()
              ? renderPast(day)
              : index === getToday()
                ? renderToday(day)
                : renderFuture()
            : renderPastUnactiveDays()}

          {/* levels */}
          {day &&
            new Array(7)
              .fill(null)
              .map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full my-1 ${day.todayLevels.includes(i + 1) ? `bg-lvl-${i + 1}` : 'bg-transparent'}`}
                ></div>
              ))}
        </span>
      ))}
    </div>
  )
}

function renderPast(day: Day) {
  return (
    <div
      className={`
        flex items-center justify-center h-6 w-6 my-2 border-2 rounded-full
        ${day.isDone ? 'border-green-600 bg-green-600' : 'border-red-500 bg-red-500'}
      `}
    >
      {day.isDone ? (
        <Check className="w-4 h-4 text-white" strokeWidth={3} />
      ) : (
        <X className="w-4 h-4 text-white" strokeWidth={3} />
      )}
    </div>
  )
}

function renderToday(day: Day) {
  // today & done
  if (day.isDone) {
    return (
      <div className="flex items-center justify-center h-6 w-6 my-2 border-2 rounded-full border-green-600 bg-green-600">
        <Check className="w-4 h-4 text-white" strokeWidth={3} />
      </div>
    )
  }

  // today & NOT done
  return (
    <div className="flex items-center justify-center h-6 w-6 my-2 border-2 border-gray-300 rounded-full">
      <div className="h-3 w-3 rounded-full bg-gradient-to-br from-purple-600 to-purple-800" />
    </div>
  )
}

function renderFuture() {
  return <div className="h-6 w-6 my-2 border-2 rounded-full border-gray-300" />
}

function renderPastUnactiveDays() {
  return (
    <div className="h-6 w-6 my-2 border-2 rounded-full bg-gray-300 border-gray-300" />
  )
}
