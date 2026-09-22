import {
  Camera,
  Download,
  LogIn,
  LogOut,
  MousePointer2,
  RefreshCw
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import Card from '@/components/card'
import ProUpgradeModal from '@/components/modals/pro-upgrade-modal'
import CardToolbar from '@/components/ui/card-toolbar'
import { appendSideBlocks, isSideEmpty } from '@/lib/check-content'
import type { CardData, CardHandle, SideBlock, SideName } from '@/types'
import { signOut, getSession } from '@ext/lib/auth'
import { normalizeCapture } from '@ext/lib/capture'
import {
  createBackup,
  decodeCardData,
  DRAFT_KEY,
  emptyCardData,
  encodeCardData,
  ensureLocalTopic,
  getCards,
  getTopics,
  PENDING_KEY,
  saveCard
} from '@ext/lib/storage'
import { bootstrapTopics, flushOutbox, hasPro } from '@ext/lib/sync'
import type { ExtensionSession, RuntimeMessage, Topic } from '@ext/types'
import AuthPanel from './auth-panel'

const APP_URL = (
  import.meta.env.WXT_PUBLIC_APP_URL ?? 'http://localhost:5173'
).replace(/\/$/, '')

export default function App() {
  const cardRef = useRef<CardHandle>(null)
  const [card, setCard] = useState<CardData>(emptyCardData)
  const cardStateRef = useRef(card)
  const [isFlipped, setIsFlipped] = useState(false)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicId, setTopicId] = useState('')
  const [session, setSession] = useState<ExtensionSession | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [localTopicId, setLocalTopicId] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showProUpgrade, setShowProUpgrade] = useState(false)
  const side: SideName = isFlipped ? 'back' : 'front'
  const isDraft = isSideEmpty(card.front) || isSideEmpty(card.back)
  cardStateRef.current = card

  const persist = useCallback(async (value: CardData) => {
    await chrome.storage.local.set({ [DRAFT_KEY]: encodeCardData(value) })
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
      await persist(next)
      await chrome.storage.local.remove(PENDING_KEY)
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
      const currentSession = await getSession()
      setSession(currentSession)
      const pro = await hasPro()
      setIsPro(pro)
      const loaded = pro ? await bootstrapTopics() : await getTopics()
      const local = await ensureLocalTopic()
      setLocalTopicId(local.id)
      if (!pro || loaded.length === 0) loaded.push(local)
      setTopics(loaded)
      setTopicId(loaded[0]?.id ?? local.id)
      setSavedCount((await getCards()).length)
      if (stored[PENDING_KEY]) {
        await handleCapture(stored[PENDING_KEY] as RuntimeMessage)
      }
    })().catch(error => toast.error(String(error)))
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [handleCapture])

  const save = async () => {
    setBusy(true)
    try {
      const data = cardRef.current?.getContent() ?? card
      const destination = topicId || (await ensureLocalTopic()).id
      await saveCard(data, destination, isPro && destination !== localTopicId)
      await flushOutbox()
      setCard(emptyCardData())
      setIsFlipped(false)
      await chrome.storage.local.remove(DRAFT_KEY)
      setSavedCount((await getCards()).length)
      toast.success(isPro ? 'Saved and synced' : 'Saved locally')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const applySession = useCallback(async (nextSession: ExtensionSession) => {
    setSession(nextSession)
    const pro = await hasPro()
    setIsPro(pro)
    const loaded = pro ? await bootstrapTopics() : await getTopics()
    const local = await ensureLocalTopic()
    setLocalTopicId(local.id)
    if (!pro || loaded.length === 0) loaded.push(local)
    setTopics(loaded)
    setTopicId(loaded[0]!.id)
    if (pro) toast.success('Sync enabled')
    else setShowProUpgrade(true)
  }, [])

  const closeAuth = useCallback(async () => {
    setShowAuth(false)
    const next = await getSession()
    if (next) await applySession(next)
  }, [applySession])

  const logout = async () => {
    await signOut()
    setSession(null)
    setIsPro(false)
  }

  const exportCards = async () => {
    const url = URL.createObjectURL(await createBackup())
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `spaced-rep-browser-cards-${new Date().toISOString()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (showAuth) {
    return (
      <main className="h-full">
        <Toaster position="top-center" />
        <AuthPanel onClose={() => void closeAuth()} />
      </main>
    )
  }

  return (
    <main className="h-full flex flex-col">
      <Toaster position="top-center" />
      <header className="h-14 px-3 border-b border-border flex items-center justify-between gap-2">
        <button
          className="text-sm font-medium min-w-12"
          onClick={() => setIsFlipped(value => !value)}
        >
          {isFlipped ? 'Back' : 'Front'}
        </button>
        <select
          className="min-w-0 max-w-44 bg-background-secondary rounded-lg px-2 py-1 text-sm"
          value={topicId}
          onChange={event => setTopicId(event.target.value)}
        >
          {topics.map(topic => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </select>
        <button
          className="text-primary font-semibold text-sm disabled:opacity-40"
          disabled={busy || (isSideEmpty(card.front) && isSideEmpty(card.back))}
          onClick={save}
        >
          {isDraft ? 'Save draft' : 'Save'}
        </button>
      </header>

      <section className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <Card
          ref={cardRef}
          data={card}
          isFlipped={isFlipped}
          isEditable
          autoFocus
          handleChange={(blocks, changedSide) => {
            const next = {
              ...card,
              [changedSide]: { ...card[changedSide], blocks }
            }
            setCard(next)
            void persist(next)
          }}
        />
      </section>

      <div className="px-3">
        <CardToolbar
          isTextDisabled={card[side].blocks.at(-1)?.type === 'text'}
          onAddBlocks={appendBlocks}
          onFocusLast={() => cardRef.current?.focusContent(side, 'last')}
          onFlip={() => setIsFlipped(value => !value)}
        />
        <div className="grid grid-cols-2 gap-2 py-2">
          <button
            className="border border-border rounded-lg py-2 text-sm flex items-center justify-center gap-2"
            onClick={() =>
              chrome.runtime.sendMessage({
                type: 'CAPTURE_SELECTION',
                side
              } satisfies RuntimeMessage)
            }
          >
            <MousePointer2 size={17} /> Selection
          </button>
          <button
            className="border border-border rounded-lg py-2 text-sm flex items-center justify-center gap-2"
            onClick={() =>
              chrome.runtime.sendMessage({
                type: 'CAPTURE_SCREENSHOT',
                side
              } satisfies RuntimeMessage)
            }
          >
            <Camera size={17} /> Screenshot
          </button>
        </div>
      </div>

      <footer className="p-3 border-t border-border flex gap-2">
        {session ? (
          <button
            className="flex-1 border border-border rounded-lg py-2 text-sm flex justify-center gap-2"
            onClick={logout}
          >
            <LogOut size={17} /> Sign out
          </button>
        ) : (
          <button
            className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm flex justify-center gap-2"
            disabled={busy}
            onClick={() => setShowAuth(true)}
          >
            <LogIn size={17} /> Sign in to sync
          </button>
        )}
        <button
          className="flex-1 border border-border rounded-lg py-2 text-sm flex justify-center gap-2 disabled:opacity-40"
          disabled={!savedCount}
          onClick={exportCards}
        >
          <Download size={17} /> Export ({savedCount})
        </button>
        {isPro && (
          <button
            title="Sync now"
            className="border border-border rounded-lg p-2"
            onClick={() => chrome.runtime.sendMessage({ type: 'SYNC_NOW' })}
          >
            <RefreshCw size={17} />
          </button>
        )}
      </footer>
      <ProUpgradeModal
        isOpen={showProUpgrade}
        onClose={() => setShowProUpgrade(false)}
        onUpgrade={() => {
          void chrome.tabs.create({
            url: `${APP_URL}/?settings=true&subscription=true`
          })
        }}
      />
    </main>
  )
}
