import { startOfDayTs } from '@/lib/get-today'

export interface StudyCard {
  level: number
  reviewDate?: number | null | undefined
}

export function gradeCard(
  level: number,
  isCorrect: boolean,
  now: number
): { level: number; reviewDate: number } {
  return {
    level: isCorrect ? level + 1 : 1,
    reviewDate: now
  }
}

export function selectDueCards<T extends StudyCard>(
  cards: T[],
  todayLevels: number[],
  now: number
): T[] {
  const levels = new Set(todayLevels)
  const startOfToday = startOfDayTs(now)

  return cards.filter(card => {
    if (!levels.has(card.level)) return false
    if (!card.reviewDate) return true
    return startOfDayTs(card.reviewDate) < startOfToday
  })
}

/** Call when the due queue is empty after the last grade. */
export function completeStudyDay(day: { isDone: boolean }): void {
  day.isDone = true
}
