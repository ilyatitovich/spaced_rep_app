export type LevelColor =
  | 'red'
  | 'rgb(21, 255, 0)'
  | 'rgb(255, 251, 0)'
  | 'rgb(0, 255, 242)'
  | 'rgb(0, 89, 255)'
  | 'rgb(183, 0, 255)'
  | 'rgb(89, 0, 255)'

export type LevelId = 'draft' | '0' | '1' | '2' | '3' | '4' | '5' | '6'

export type TopicItem = {
  id: string
  title: string
}

export type Card = {
  id: number
  level: number
  front: string
  back: string
}

export type Level = {
  id: number
  color: LevelColor
  cards: Card[]
}

export type DayOfWeek = {
  date: number
  reviewLevels: number[]
  isCompleted: boolean
}

export type Topic = {
  id: string
  title: string
  pivot: number
  week: Array<DayOfWeek | null>
  draft: Card[]
  levels: Level[]
  nextUpdateDate: number
}
