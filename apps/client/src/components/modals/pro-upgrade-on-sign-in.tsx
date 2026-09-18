import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import ProUpgradeModal from './pro-upgrade-modal'
import { useAuth } from '@/contexts'
import { useSettingsStore } from '@/store'

export default function ProUpgradeOnSignIn() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const previousUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const userId = user?.id ?? null
    const signedIn = previousUserId.current === null && userId !== null
    previousUserId.current = userId
    if (!signedIn || !userId) return

    let cancelled = false
    void useSettingsStore
      .getState()
      .pullRemote(userId)
      .then(() => {
        if (!cancelled && !useSettingsStore.getState().hasPlan('pro')) {
          setIsOpen(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <ProUpgradeModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onUpgrade={() => {
        void navigate('/?settings=true&subscription=true')
      }}
    />
  )
}
