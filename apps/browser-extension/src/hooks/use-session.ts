import { useCallback, useState } from 'react'

import { APP_URL } from '../lib/app-url'
import { getSession, signOut as signOutSession } from '../lib/auth'
import { hasPro } from '../services/sync.service'
import type { ExtensionSession } from '../types'

export function useSession() {
  const [session, setSession] = useState<ExtensionSession | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showProUpgrade, setShowProUpgrade] = useState(false)

  const refresh = useCallback(async () => {
    const next = await getSession()
    setSession(next)
    const pro = await hasPro()
    setIsPro(pro)
    return { session: next, isPro: pro }
  }, [])

  const signOut = useCallback(async () => {
    await signOutSession()
    setSession(null)
    setIsPro(false)
  }, [])

  const signIn = useCallback(() => setShowAuth(true), [])
  const closeAuth = useCallback(() => setShowAuth(false), [])
  const openProUpgrade = useCallback(() => setShowProUpgrade(true), [])
  const closeProUpgrade = useCallback(() => setShowProUpgrade(false), [])

  const openUpgrade = useCallback(() => {
    void chrome.tabs.create({
      url: `${APP_URL}/?settings=true&subscription=true`
    })
  }, [])

  const syncNow = useCallback(() => {
    void chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
  }, [])

  return {
    session,
    isPro,
    showAuth,
    showProUpgrade,
    refresh,
    signIn,
    signOut,
    closeAuth,
    closeProUpgrade,
    openProUpgrade,
    openUpgrade,
    syncNow
  }
}
