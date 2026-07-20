import { useEffect, useState } from 'react'

import {
  dismissInstallPrompt,
  dismissSoftBanner,
  hasRelatedAppInstalled,
  isInstallPromptDismissed,
  isIos,
  isIosSafari,
  isSoftBannerDismissed,
  isStandaloneDisplay
} from '@/lib'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallVariant =
  | 'hidden'
  | 'chromium-install'
  | 'ios-safari-a2hs'
  | 'ios-open-safari'
  | 'soft-banner'

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(isInstallPromptDismissed)
  const [relatedInstalled, setRelatedInstalled] = useState(false)
  const [softBannerDismissed, setSoftBannerDismissed] = useState(
    isSoftBannerDismissed
  )

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    function onAppInstalled() {
      setDeferredPrompt(null)
      setInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (isStandaloneDisplay()) return
    hasRelatedAppInstalled().then(setRelatedInstalled)
  }, [])

  let variant: InstallVariant = 'hidden'

  if (!installed && !isStandaloneDisplay()) {
    if (relatedInstalled) {
      variant = softBannerDismissed ? 'hidden' : 'soft-banner'
    } else if (!dismissed) {
      if (deferredPrompt) {
        variant = 'chromium-install'
      } else if (isIosSafari()) {
        variant = 'ios-safari-a2hs'
      } else if (isIos()) {
        variant = 'ios-open-safari'
      }
    }
  }

  async function promptInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'dismissed') dismiss()
  }

  function dismiss() {
    dismissInstallPrompt()
    setDismissed(true)
  }

  function dismissBanner() {
    dismissSoftBanner()
    setSoftBannerDismissed(true)
  }

  return { variant, promptInstall, dismiss, dismissBanner }
}
