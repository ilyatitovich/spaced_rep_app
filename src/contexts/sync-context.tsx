import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { useAuth } from './auth-context'
import { useOnlineVerified } from '@/hooks'
import {
  getSyncState,
  subscribeSync,
  syncNow,
  type SyncState
} from '@/services'

type SyncContextValue = SyncState & {
  isOnline: boolean
  syncNow: () => void
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isOnline = useOnlineVerified()
  const [syncState, setSyncState] = useState<SyncState>(getSyncState())

  useEffect(() => subscribeSync(setSyncState), [])

  useEffect(() => {
    if (isOnline && user) syncNow()
  }, [isOnline, user])

  useEffect(() => {
    if (!user) return

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncNow()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [user])

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
