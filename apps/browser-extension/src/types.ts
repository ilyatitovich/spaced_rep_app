import type { CardData, SideBlock, SideName } from '@/types/card.types'

export type { CardData, SideBlock, SideName }

export interface Card {
  id: string
  topicId: string
  level: number
  data: unknown
  reviewDate?: number
  updatedAt: number
}

export interface CapturedContent {
  blocks: SideBlock[]
  source: { title: string; url: string }
}

export interface ExtensionSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: { id: string; email: string }
}

export type RuntimeMessage =
  | { type: 'OPEN_PANEL' }
  | { type: 'CAPTURE_SELECTION'; side: SideName }
  | { type: 'CAPTURE_SCREENSHOT'; side: SideName }
  | {
      type: 'RAW_CAPTURE'
      side: SideName
      raw: import('./lib/capture').RawCapture
    }
  | { type: 'CAPTURED'; side: SideName; payload: CapturedContent }
  | { type: 'AUTH_START' }
  | { type: 'SYNC_NOW' }
