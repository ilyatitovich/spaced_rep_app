import { Check, X } from 'lucide-react'

import { Day } from '@/lib/helpers'

type WeekProps = {
  week: Array<Day | null>
  today: number
}

// const fakeWeek = [
//   { isDone: true },
//   { isDone: true },
//   { isDone: false },
//   { isDone: false },
//   { isDone: false },
//   { isDone: true },
//   { isDone: true }
// ]

const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Week({ week, today }: WeekProps) {
  return (
    <div className="flex justify-between week">
      {week.map((day, index) => (
        <span key={index} className="day flex flex-col items-center">
          <small className={day ? 'text-black' : 'text-gray-300'}>
            {letters[index]}
          </small>

          {/* status */}
          {day ? (
            index < today ? (
              <div
                className={`flex items-center justify-center h-6 w-6 my-2 border-2 rounded-full ${day.isDone ? 'border-green-600 bg-green-600' : 'border-red-500 bg-red-500'}`}
              >
                {day.isDone ? (
                  <Check
                    className="w-4 h-4 text-white transition-transform duration-200"
                    strokeWidth={3}
                  />
                ) : (
                  <X
                    className="w-4 h-4 text-white transition-transform duration-200"
                    strokeWidth={3}
                  />
                )}
              </div>
            ) : (
              <div
                className={`flex items-center justify-center h-6 w-6 my-2 rounded-full border-2
            ${today === index ? 'border-purple-600 bg-purple-600' : 'border-gray-300 bg-transparent'}`}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-6 w-6 my-2 border-2 bg-gray-300 border-gray-300 rounded-full" />
          )}

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
