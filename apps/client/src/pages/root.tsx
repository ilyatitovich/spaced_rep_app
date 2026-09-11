import { Outlet } from 'react-router'

import { DesktopMessage, InstallAppSheet, UpdateAppSheet } from '@/components'
import { useIsMobile, usePwaInstall, usePwaUpdate } from '@/hooks'
import { isOnboardingComplete } from '@/lib'

export default function Root() {
  const isMobile = useIsMobile()
  const { variant, promptInstall, dismiss, dismissBanner } = usePwaInstall()
  const {
    showPrompt: showUpdatePrompt,
    updateNow,
    dismiss: dismissUpdate
  } = usePwaUpdate()

  if (!isMobile) {
    return <DesktopMessage />
  }

  return (
    <>
      <Outlet />
      {isOnboardingComplete() && (
        <InstallAppSheet
          variant={variant}
          onInstall={promptInstall}
          onDismiss={dismiss}
          onDismissBanner={dismissBanner}
        />
      )}
      <UpdateAppSheet
        isOpen={showUpdatePrompt}
        onUpdate={updateNow}
        onLater={dismissUpdate}
      />
    </>
  )
}
