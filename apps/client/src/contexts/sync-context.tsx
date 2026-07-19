import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { useAuth } from './auth-context'
import { useOnline } from '@/hooks'
import {
  getSyncState,
  subscribeSync,
  syncNow,
  type SyncState,
  triggerSettingsFlush
} from '@/services'
import { useSettingsStore } from '@/store/settings-store'

type SyncContextValue = SyncState & {
  isOnline: boolean
  syncNow: () => void
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined)

export function SyncProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnline()
  const { user } = useAuth()
  const [syncState, setSyncState] = useState<SyncState>(getSyncState())

  useEffect(() => subscribeSync(setSyncState), [])

  useEffect(() => {
    if (!user || !isOnline) return
    syncNow()
    triggerSettingsFlush()
  }, [user, isOnline])

  useEffect(() => {
    function onVisibility(): void {
      if (document.visibilityState === 'visible' && user && isOnline) {
        syncNow()
        triggerSettingsFlush()
        void useSettingsStore.getState().pullRemote(user.id)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [user, isOnline])

  const value: SyncContextValue = { ...syncState, isOnline, syncNow }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}
