import { Outlet } from 'react-router'

import { DesktopMessage, InstallAppSheet } from '@/components'
import { useIsMobile, usePwaInstall } from '@/hooks'
import { isOnboardingComplete } from '@/lib'

export default function Root() {
  const isMobile = useIsMobile()
  const { variant, promptInstall, dismiss, dismissBanner } = usePwaInstall()

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
    </>
  )
}
