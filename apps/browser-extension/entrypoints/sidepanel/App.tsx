import { useCallback, useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import ProUpgradeModal from '@/components/modals/pro-upgrade-modal'
import { useActivePage } from '@ext/hooks/use-active-page'
import { useCards } from '@ext/hooks/use-cards'
import { useDraftCard } from '@ext/hooks/use-draft-card'
import { useSession } from '@ext/hooks/use-session'
import { useTopics } from '@ext/hooks/use-topics'
import { createBackup } from '@ext/services/backup.service'
import CardsScreen from '@ext/ui/cards-screen'
import EditorScreen from '@ext/ui/editor-screen'
import PanelFooter from '@ext/ui/panel-footer'
import AuthPanel from './auth-panel'

export default function App() {
  const session = useSession()
  const topics = useTopics()
  const cards = useCards()
  const draft = useDraftCard({
    topicId: topics.selectedId,
    isPro: session.isPro,
    localTopicId: topics.localTopicId,
    onSaved: cards.refresh
  })
  useActivePage(draft.source)
  const [view, setView] = useState<'editor' | 'cards'>('editor')

  const refresh = useCallback(async () => {
    const snapshot = await session.refresh()
    await Promise.all([topics.refresh(snapshot.isPro), cards.refresh()])
    return snapshot
  }, [session.refresh, topics.refresh, cards.refresh])

  useEffect(() => {
    void refresh().catch(error => toast.error(String(error)))
  }, [refresh])

  const handleCloseAuth = useCallback(async () => {
    session.closeAuth()
    const snapshot = await refresh()
    if (!snapshot.session) return
    if (snapshot.isPro) toast.success('Sync enabled')
    else session.openProUpgrade()
  }, [session.closeAuth, session.openProUpgrade, refresh])

  const exportCards = async () => {
    const url = URL.createObjectURL(await createBackup())
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `spaced-rep-browser-cards-${new Date().toISOString()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="h-full flex flex-col">
      <Toaster position="top-center" />
      {session.showAuth ? (
        <AuthPanel onClose={() => void handleCloseAuth()} />
      ) : (
        <>
          {view === 'cards' ? (
            <CardsScreen
              count={cards.savedCount}
              onShowEditor={() => setView('editor')}
            />
          ) : (
            <EditorScreen
              draft={draft}
              topics={topics.topics}
              selectedId={topics.selectedId}
              onSelectTopic={topics.select}
              onShowCards={() => setView('cards')}
            />
          )}
          <PanelFooter
            signedIn={Boolean(session.session)}
            isPro={session.isPro}
            busy={draft.busy}
            savedCount={cards.savedCount}
            onSignIn={session.signIn}
            onSignOut={() => void session.signOut()}
            onExport={() => void exportCards()}
            onSync={session.syncNow}
          />
          <ProUpgradeModal
            isOpen={session.showProUpgrade}
            onClose={session.closeProUpgrade}
            onUpgrade={session.openUpgrade}
          />
        </>
      )}
    </main>
  )
}
