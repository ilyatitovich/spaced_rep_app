import { describe, expect, it } from 'vitest'

import { Day } from '@/models'
import { completeStudyDay, gradeCard, selectDueCards } from '../study'

describe('selectDueCards', () => {
  const now = new Date(2026, 10, 4, 15, 0, 0).getTime() // Wed
  const earlierToday = new Date(2026, 10, 4, 9, 0, 0).getTime()
  const yesterday = new Date(2026, 10, 3, 18, 0, 0).getTime()

  it('on pivot day queues only level 1; level-0 draft and level-8 finished stay out', () => {
    const pivot = new Date(2026, 10, 4, 12, 0, 0).getTime()
    const day = new Day(pivot)
    day.setLevelList(pivot)
    expect(day.todayLevels).toEqual([1])

    const due = selectDueCards(
      [
        { id: 'draft', level: 0 },
        { id: 'due', level: 1 },
        { id: 'done', level: 8 }
      ],
      day.todayLevels,
      now
    )

    expect(due.map(c => c.id)).toEqual(['due'])
  })

  it('a card moved onto today via updateCardsLevelBulk with no reviewDate is due in the same session', () => {
    const due = selectDueCards([{ id: 'moved', level: 1 }], [1], now)

    expect(due.map(c => c.id)).toEqual(['moved'])
  })

  it('excludes a card reviewed earlier today and includes one reviewed yesterday', () => {
    const due = selectDueCards(
      [
        { id: 'today', level: 1, reviewDate: earlierToday },
        { id: 'yesterday', level: 1, reviewDate: yesterday }
      ],
      [1],
      now
    )

    expect(due.map(c => c.id)).toEqual(['yesterday'])
  })
})

describe('gradeCard', () => {
  const now = 1_730_000_000_000

  it('correct on level 1 stores level 2 and reviewDate of now', () => {
    expect(gradeCard(1, true, now)).toEqual({ level: 2, reviewDate: now })
  })

  it('correct on level 7 stores level 8 and reviewDate of now', () => {
    expect(gradeCard(7, true, now)).toEqual({ level: 8, reviewDate: now })
  })

  it('wrong on level 5 stores level 1 and reviewDate of now', () => {
    expect(gradeCard(5, false, now)).toEqual({ level: 1, reviewDate: now })
  })
})

describe('completeStudyDay', () => {
  it('marks today done when the last due card has been graded', () => {
    const day = new Day(new Date(2026, 10, 4).getTime())
    expect(day.isDone).toBe(false)

    completeStudyDay(day)

    expect(day.isDone).toBe(true)
  })
})
