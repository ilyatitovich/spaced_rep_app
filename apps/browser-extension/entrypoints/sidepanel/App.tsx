import {
  Camera,
  Download,
  LogIn,
  LogOut,
  MousePointer2,
  RefreshCw
} from 'lucide-react'
import { useCallback, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import Card from '@/components/card'
import ProUpgradeModal from '@/components/modals/pro-upgrade-modal'
import CardToolbar from '@/components/ui/card-toolbar'
import { useActivePage } from '@ext/hooks/use-active-page'
import { useCards } from '@ext/hooks/use-cards'
import { useDraftCard } from '@ext/hooks/use-draft-card'
import { useSession } from '@ext/hooks/use-session'
import { useTopics } from '@ext/hooks/use-topics'
import { createBackup } from '@ext/services/backup.service'
import AuthPanel from './auth-panel'

export default function App() {
  const {
    session,
    isPro,
    showAuth,
    showProUpgrade,
    refresh: refreshSession,
    signIn,
    signOut,
    closeAuth,
    closeProUpgrade,
    openProUpgrade,
    openUpgrade,
    syncNow
  } = useSession()
  const {
    topics,
    selectedId,
    localTopicId,
    select,
    refresh: refreshTopics
  } = useTopics()
  const { savedCount, refresh: refreshCards } = useCards()
  const draft = useDraftCard({
    topicId: selectedId,
    isPro,
    localTopicId,
    onSaved: refreshCards
  })
  useActivePage(draft.source)

  const refresh = useCallback(async () => {
    const snapshot = await refreshSession()
    await Promise.all([refreshTopics(snapshot.isPro), refreshCards()])
    return snapshot
  }, [refreshSession, refreshTopics, refreshCards])

  useEffect(() => {
    void refresh().catch(error => toast.error(String(error)))
  }, [refresh])

  const handleCloseAuth = useCallback(async () => {
    closeAuth()
    const snapshot = await refresh()
    if (!snapshot.session) return
    if (snapshot.isPro) toast.success('Sync enabled')
    else openProUpgrade()
  }, [closeAuth, openProUpgrade, refresh])

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
        <AuthPanel onClose={() => void handleCloseAuth()} />
      </main>
    )
  }

  return (
    <main className="h-full flex flex-col">
      <Toaster position="top-center" />
      <header className="h-14 px-3 border-b border-border flex items-center justify-between gap-2">
        <button
          className="text-sm font-medium min-w-12"
          onClick={draft.flip}
        >
          {draft.isFlipped ? 'Back' : 'Front'}
        </button>
        <select
          className="min-w-0 max-w-44 bg-background-secondary rounded-lg px-2 py-1 text-sm"
          value={selectedId}
          onChange={event => select(event.target.value)}
        >
          {topics.map(topic => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </select>
        <button
          className="text-primary font-semibold text-sm disabled:opacity-40"
          disabled={draft.busy || draft.isEmpty}
          onClick={() => void draft.save()}
        >
          {draft.isDraft ? 'Save draft' : 'Save'}
        </button>
      </header>

      <section className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <Card
          ref={draft.cardRef}
          data={draft.card}
          isFlipped={draft.isFlipped}
          isEditable
          autoFocus
          handleChange={draft.handleChange}
        />
      </section>

      <div className="px-3">
        <CardToolbar
          isTextDisabled={draft.card[draft.side].blocks.at(-1)?.type === 'text'}
          onAddBlocks={draft.appendBlocks}
          onFocusLast={() =>
            draft.cardRef.current?.focusContent(draft.side, 'last')
          }
          onFlip={draft.flip}
        />
        <div className="grid grid-cols-2 gap-2 py-2">
          <button
            className="border border-border rounded-lg py-2 text-sm flex items-center justify-center gap-2"
            onClick={draft.captureSelection}
          >
            <MousePointer2 size={17} /> Selection
          </button>
          <button
            className="border border-border rounded-lg py-2 text-sm flex items-center justify-center gap-2"
            onClick={draft.captureScreenshot}
          >
            <Camera size={17} /> Screenshot
          </button>
        </div>
      </div>

      <footer className="p-3 border-t border-border flex gap-2">
        {session ? (
          <button
            className="flex-1 border border-border rounded-lg py-2 text-sm flex justify-center gap-2"
            onClick={() => void signOut()}
          >
            <LogOut size={17} /> Sign out
          </button>
        ) : (
          <button
            className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm flex justify-center gap-2"
            disabled={draft.busy}
            onClick={signIn}
          >
            <LogIn size={17} /> Sign in to sync
          </button>
        )}
        <button
          className="flex-1 border border-border rounded-lg py-2 text-sm flex justify-center gap-2 disabled:opacity-40"
          disabled={!savedCount}
          onClick={() => void exportCards()}
        >
          <Download size={17} /> Export ({savedCount})
        </button>
        {isPro && (
          <button
            title="Sync now"
            className="border border-border rounded-lg p-2"
            onClick={syncNow}
          >
            <RefreshCw size={17} />
          </button>
        )}
      </footer>
      <ProUpgradeModal
        isOpen={showProUpgrade}
        onClose={closeProUpgrade}
        onUpgrade={openUpgrade}
      />
    </main>
  )
}
