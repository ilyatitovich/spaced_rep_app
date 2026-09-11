import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

type PwaUpdateContextValue = {
  needRefresh: boolean
  showPrompt: boolean
  updateNow: () => void
  checkForUpdate: () => Promise<
    'available' | 'current' | 'offline' | 'unavailable'
  >
  dismiss: () => void
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | undefined>(
  undefined
)

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>()
  const [dismissed, setDismissed] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration
    }
  })

  // New update after dismiss should show the sheet again.
  useEffect(() => {
    if (needRefresh) return
    setDismissed(false)
  }, [needRefresh])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!navigator.onLine) return
      void registrationRef.current?.update()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const updateNow = useCallback(() => {
    void updateServiceWorker(true)
  }, [updateServiceWorker])

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (!navigator.onLine) return 'offline' as const
    const registration = registrationRef.current
    if (!registration) return 'unavailable' as const

    await registration.update()

    if (registration.waiting) {
      setNeedRefresh(true)
      setDismissed(false)
      return 'available' as const
    }
    return 'current' as const
  }, [setNeedRefresh])

  const value: PwaUpdateContextValue = {
    needRefresh,
    showPrompt: needRefresh && !dismissed,
    updateNow,
    checkForUpdate,
    dismiss
  }

  return createElement(PwaUpdateContext.Provider, { value }, children)
}

export function usePwaUpdate() {
  const ctx = useContext(PwaUpdateContext)
  if (!ctx) {
    throw new Error('usePwaUpdate must be used within PwaUpdateProvider')
  }
  return ctx
}
