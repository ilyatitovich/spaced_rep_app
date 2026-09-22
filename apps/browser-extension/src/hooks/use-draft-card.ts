import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { appendSideBlocks, isSideEmpty } from '@/lib/check-content'
import type { CardData, CardHandle, SideBlock, SideName } from '@/types'
import { getActivePage } from '../lib/active-page'
import {
  decodeCardData,
  emptyCardData,
  encodeCardData
} from '../lib/card-codec'
import { normalizeCapture } from '../lib/capture'
import { readValue, removeKeys, writeValue } from '../lib/chrome-store'
import { DRAFT_KEY, PENDING_KEY } from '../lib/keys'
import { saveCard, updateCard } from '../services/cards.service'
import { flushOutbox } from '../services/sync.service'
import { ensureTopicForPage } from '../services/topics.service'
import type { Card, CapturedContent, RuntimeMessage } from '../types'

function isCaptureMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false
  }
  return value.type === 'RAW_CAPTURE' || value.type === 'CAPTURED'
}

export function useDraftCard({
  topicId,
  isPro,
  pendingTitle,
  onSaved
}: {
  topicId: string
  isPro: boolean
  pendingTitle: string
  onSaved?: () => Promise<unknown> | unknown
}) {
  const cardRef = useRef<CardHandle>(null)
  const [card, setCard] = useState<CardData>(emptyCardData)
  const cardStateRef = useRef(card)
  const [isFlipped, setIsFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState<CapturedContent['source'] | null>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const editingIdRef = useRef<string | null>(null)
  const side: SideName = isFlipped ? 'back' : 'front'
  const isDraft = isSideEmpty(card.front) || isSideEmpty(card.back)
  cardStateRef.current = card

  const persist = useCallback(async (value: CardData) => {
    if (editingIdRef.current) return
    await writeValue(DRAFT_KEY, encodeCardData(value))
  }, [])

  const appendBlocks = useCallback(
    (blocks: SideBlock[]) => {
      const latest = cardRef.current?.getContent() ?? cardStateRef.current
      const next = {
        ...latest,
        [side]: {
          ...latest[side],
          blocks: appendSideBlocks(latest[side].blocks, blocks)
        }
      }
      setCard(next)
      void persist(next)
    },
    [persist, side]
  )

  const handleCapture = useCallback(
    async (message: RuntimeMessage) => {
      if (message.type === 'RAW_CAPTURE') {
        const payload = await normalizeCapture(message.raw)
        message = { type: 'CAPTURED', side: message.side, payload }
      }
      if (message.type !== 'CAPTURED') return
      const latest = cardRef.current?.getContent() ?? cardStateRef.current
      const next: CardData = {
        ...latest,
        [message.side]: {
          ...latest[message.side],
          blocks: appendSideBlocks(
            latest[message.side].blocks,
            message.payload.blocks
          )
        }
      }
      setCard(next)
      setSource(message.payload.source)
      await persist(next)
      await removeKeys([PENDING_KEY])
      toast.success(`Added from ${message.payload.source.title || 'page'}`)
    },
    [persist]
  )

  useEffect(() => {
    const listener = (message: RuntimeMessage) => void handleCapture(message)
    chrome.runtime.onMessage.addListener(listener)
    void (async () => {
      const stored = await chrome.storage.local.get([DRAFT_KEY, PENDING_KEY])
      if (stored[DRAFT_KEY]) setCard(decodeCardData(stored[DRAFT_KEY]))
      if (isCaptureMessage(stored[PENDING_KEY])) {
        await handleCapture(stored[PENDING_KEY])
      }
    })().catch(error => toast.error(String(error)))
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [handleCapture])

  const save = async () => {
    setBusy(true)
    try {
      const data = cardRef.current?.getContent() ?? card
      if (editingCardId) {
        const updated = await updateCard(editingCardId, data, isPro)
        if (!updated) throw new Error('Card no longer exists')
        editingIdRef.current = null
        setEditingCardId(null)
        const stored = await readValue(DRAFT_KEY)
        setCard(stored ? decodeCardData(stored) : emptyCardData())
      } else {
        const tab = await getActivePage()
        const destination =
          topicId ||
          (
            await ensureTopicForPage(
              {
                title: pendingTitle || tab.title || source?.title || '',
                url: tab.url || source?.url || ''
              },
              isPro
            )
          ).id
        await saveCard(data, destination, isPro)
        setCard(emptyCardData())
        await removeKeys([DRAFT_KEY])
      }
      await flushOutbox()
      setIsFlipped(false)
      await onSaved?.()
      toast.success(isPro ? 'Saved and synced' : 'Saved locally')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const edit = (stored: Card) => {
    editingIdRef.current = stored.id
    setEditingCardId(stored.id)
    setCard(decodeCardData(stored.data))
    setIsFlipped(false)
  }

  const handleChange = (blocks: SideBlock[], changedSide: SideName) => {
    const next = {
      ...card,
      [changedSide]: { ...card[changedSide], blocks }
    }
    setCard(next)
    void persist(next)
  }

  const requestCapture = (type: 'CAPTURE_SELECTION' | 'CAPTURE_SCREENSHOT') => {
    void chrome.runtime.sendMessage({ type, side } satisfies RuntimeMessage)
  }

  return {
    card,
    cardRef,
    side,
    isFlipped,
    isDraft,
    isEmpty: isSideEmpty(card.front) && isSideEmpty(card.back),
    busy,
    source,
    appendBlocks,
    handleChange,
    save,
    edit,
    editingCardId,
    flip: () => setIsFlipped(value => !value),
    captureSelection: () => requestCapture('CAPTURE_SELECTION'),
    captureScreenshot: () => requestCapture('CAPTURE_SCREENSHOT')
  }
}
