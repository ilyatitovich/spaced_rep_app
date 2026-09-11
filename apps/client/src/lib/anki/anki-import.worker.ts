import { parseApkg } from './parse-apkg'
import { apkgToCards } from './to-card-data'
import type { Card } from '@/models/card.model'
import type { SideBlock } from '@/types'

type Request = {
  buffer: ArrayBuffer
  topicId: string
}

type OkResponse = { ok: true; cards: Card[] }
type ErrResponse = { ok: false; message: string }

function collectMediaBuffers(cards: Card[]): Transferable[] {
  // Same Anki media file can appear on many notes; transfer list must be unique.
  const seen = new Set<ArrayBuffer>()
  for (const card of cards) {
    for (const side of [card.data.front, card.data.back]) {
      for (const block of side.blocks as SideBlock[]) {
        if (
          (block.type === 'image' || block.type === 'audio') &&
          'buffer' in block.content
        ) {
          seen.add(block.content.buffer)
        }
      }
    }
  }
  return [...seen]
}

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    const { buffer, topicId } = event.data
    const cards = apkgToCards(await parseApkg(buffer), topicId)
    const response: OkResponse = { ok: true, cards }
    self.postMessage(response, { transfer: collectMediaBuffers(cards) })
  } catch (err) {
    const response: ErrResponse = {
      ok: false,
      message: err instanceof Error ? err.message : 'Import failed'
    }
    self.postMessage(response)
  }
}
