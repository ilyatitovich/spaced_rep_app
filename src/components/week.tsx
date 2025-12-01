import { Check, X } from 'lucide-react'

import { getToday } from '@/lib'
import { Day } from '@/models'

type WeekProps = {
  week: Array<Day | null>
}

const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Week({ week }: WeekProps) {
  return (
    <div className="flex justify-between">
      {week.map((day, index) => (
        <span key={index} className="flex flex-col items-center">
          <small
            className={`font-semibold ${index === getToday() ? 'text-purple-600' : `${day ? 'text-black' : 'text-gray-300'}`}`}
          >
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
                  className={`w-2 h-2 rounded-full my-0.5 ${day.todayLevels.includes(i + 1) ? `bg-lvl-${i + 1}` : 'bg-transparent'}`}
                ></div>
              ))
              .reverse()}
        </span>
      ))}
    </div>
  )
}

function renderPast(day: Day): JSX.Element {
  return (
    <div
      className="
        flex items-center justify-center h-7 w-7 my-2 border-2 rounded-full border-black"
    >
      {day.isDone ? (
        <Check className="w-4 h-4 text-green-600" strokeWidth={6} />
      ) : (
        <X className="w-4 h-4 text-red-500" strokeWidth={6} />
      )}
    </div>
  )
}

function renderToday(day: Day): JSX.Element {
  // today & done
  if (day.isDone) {
    return (
      <div className="flex items-center justify-center h-7 w-7 my-2 border-2 rounded-full border-black">
        <Check className="w-4 h-4 text-green-600" strokeWidth={6} />
      </div>
    )
  }

  // today & NOT done
  return (
    <div className="flex items-center justify-center h-7 w-7 my-2 border-2 border-black rounded-full">
      <div className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-purple-500 to-purple-800" />
    </div>
  )
}

function renderFuture(): JSX.Element {
  return <div className="h-7 w-7 my-2 border-2 rounded-full border-black" />
}

function renderPastUnactiveDays(): JSX.Element {
  return <div className="h-7 w-7 my-2 border-2 rounded-full border-gray-300" />
}
