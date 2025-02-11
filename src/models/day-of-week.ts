export class DayOfWeek {
  date: number
  reviewLevels: number[] = [0]
  isCompleted: boolean

  constructor(date: number) {
    this.date = date
    this.isCompleted = false
  }

  calculateReviewLevels(
    pivot: number,
    intervals: number[] = [2, 5, 9, 17, 33, 65]
  ) {
    const daysSinceStart = Math.floor((this.date - pivot) / 86400000 + 1)

    intervals.forEach((interval, index) => {
      if (daysSinceStart % interval === 0) {
        this.reviewLevels.push(index + 1)
      }
    })
  }
}
