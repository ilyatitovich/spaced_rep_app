import { useCallback, useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import ProUpgradeModal from '@/components/modals/pro-upgrade-modal'
import { useActivePage } from '@ext/hooks/use-active-page'
import { useCards } from '@ext/hooks/use-cards'
import { useDraftCard } from '@ext/hooks/use-draft-card'
import { useSession } from '@ext/hooks/use-session'
import { useTopics } from '@ext/hooks/use-topics'
import CardsScreen from '@ext/ui/cards-screen'
import EditorScreen from '@ext/ui/editor-screen'
import PanelFooter from '@ext/ui/panel-footer'
import AuthPanel from './auth-panel'
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

  const refresh = useCallback(async () => {
    const snapshot = await session.refresh()
    await Promise.all([topics.refresh(snapshot.isPro), cards.refresh()])
    return snapshot
  }, [session.refresh, topics.refresh, cards.refresh])

  useEffect(() => {
    void refresh().catch(error => toast.error(String(error)))
  }, [refresh])

  useEffect(() => {
    void topics.syncPage(page)
  }, [page.url, topics.syncPage])

  const handleCloseAuth = useCallback(async () => {
    session.closeAuth()
    const snapshot = await refresh()
    if (!snapshot.session) return
    if (snapshot.isPro) toast.success('Sync enabled')
    else session.openProUpgrade()
  }, [session.closeAuth, session.openProUpgrade, refresh])

  return (
    <main className="h-full flex flex-col">
      <Toaster position="top-center" />
      <PanelHeader
        isSignedIn={Boolean(session.session)}
        isLoading={draft.busy}
        onSignIn={session.signIn}
        onSignOut={() => void session.signOut()}
      />

      {session.showAuth ? (
        <AuthPanel onClose={() => void handleCloseAuth()} />
      ) : (
        <>
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
