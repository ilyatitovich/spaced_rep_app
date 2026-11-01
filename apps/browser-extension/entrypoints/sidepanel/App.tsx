import { useCallback, useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import ProUpgradeModal from '@/components/modals/pro-upgrade-modal'
import { useActivePage } from '@ext/hooks/use-active-page'
import { useCards } from '@ext/hooks/use-cards'
import { useDraftCard } from '@ext/hooks/use-draft-card'
import { useSession } from '@ext/hooks/use-session'
import { useTopics } from '@ext/hooks/use-topics'
import { CardsScreen, EditorScreen, AuthScreen } from '@ext/screens'
import PanelFooter from '@ext/ui/panel-footer'
import PanelHeader from '@ext/ui/panel-header'

export default function App() {
  const session = useSession()
  const topics = useTopics()
  const cards = useCards()
  const draft = useDraftCard({
    topicId: topics.selectedId,
    isPro: session.isPro,
    pendingTitle: topics.pendingTitle,
    onSaved: async () => {
      await Promise.all([topics.refresh(session.isPro), cards.refresh()])
    }
  })
  const page = useActivePage(draft.source)
  const [view, setView] = useState<'editor' | 'cards'>('editor')
  const refreshSession = session.refresh
  const closeAuth = session.closeAuth
  const openProUpgrade = session.openProUpgrade
  const refreshTopics = topics.refresh
  const syncPage = topics.syncPage
  const refreshCards = cards.refresh

  const refresh = useCallback(async () => {
    const snapshot = await refreshSession()
    await Promise.all([refreshTopics(snapshot.isPro), refreshCards()])
    return snapshot
  }, [refreshSession, refreshTopics, refreshCards])

  useEffect(() => {
    void refresh().catch(error => toast.error(String(error)))
  }, [refresh])

  useEffect(() => {
    void syncPage(page)
  }, [page, syncPage])

  const handleCloseAuth = useCallback(async () => {
    closeAuth()
    const snapshot = await refresh()
    if (!snapshot.session) return
    if (snapshot.isPro) toast.success('Sync enabled')
    else openProUpgrade()
  }, [closeAuth, openProUpgrade, refresh])

  return (
    <main className="h-full flex flex-col">
      <Toaster position="top-center" />

      {session.showAuth ? (
        <AuthScreen onClose={() => void handleCloseAuth()} />
      ) : (
        <>
          <PanelHeader
            isSignedIn={Boolean(session.session)}
            isLoading={draft.busy}
            onSignIn={session.signIn}
            onSignOut={() => void session.signOut()}
          />
          {view === 'cards' ? (
            <CardsScreen
              cards={cards.cards}
              topics={topics.topics}

              onEdit={card => {
                draft.edit(card)
                setView('editor')
              }}
              onDelete={cards.remove}
            />
          ) : (
            <EditorScreen
              draft={draft}
              topics={topics.topics}
              selectedId={topics.selectedId}
              pageTitle={topics.pendingTitle || page.title}
              onSelectTopic={topics.select}
              onCreateTopic={topics.create}
              onRenameTopic={title => void topics.rename(title)}
            />
          )}
          <PanelFooter
            savedCount={cards.savedCount}
            view={view}
            onExport={async () => {
              await cards.refresh()
            }}
            onShowEditor={() => setView('editor')}
            onShowCards={() => setView('cards')}
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
