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
            className={`font-semibold ${index === getToday() ? 'text-primary' : `${day ? 'text-foreground' : 'text-foreground-subtle'}`}`}
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

function renderPast(day: Day) {
  return (
    <div
      className="
        flex items-center justify-center h-7 w-7 my-2 border-2 rounded-full border-foreground"
    >
      {day.isDone ? (
        <Check className="w-4 h-4 text-success" strokeWidth={6} />
      ) : (
        <X className="w-4 h-4 text-danger" strokeWidth={6} />
      )}
    </div>
  )
}

function renderToday(day: Day) {
  // today & done
  if (day.isDone) {
    return (
      <div className="flex items-center justify-center h-7 w-7 my-2 border-2 rounded-full border-foreground">
        <Check className="w-4 h-4 text-success" strokeWidth={6} />
      </div>
    )
  }

  // today & NOT done
  return (
    <div className="flex items-center justify-center h-7 w-7 my-2 border-2 border-foreground rounded-full">
      <div className="h-3.5 w-3.5 rounded-full bg-linear-to-br from-primary to-primary-active" />
    </div>
  )
}

function renderFuture() {
  return (
    <div className="h-7 w-7 my-2 border-2 rounded-full border-foreground" />
  )
}

function renderPastUnactiveDays() {
  return <div className="h-7 w-7 my-2 border-2 rounded-full border-border" />
}
