import { Outlet } from 'react-router'

import { DesktopMessage, PwaModal } from '@/components'
import { useIsMobile, useKeyboardManager } from '@/hooks'

export default function Root() {
  const isMobile = useIsMobile()
  useKeyboardManager()

  if (!isMobile) {
    return <DesktopMessage />
  }

  return (
    <>
      <Outlet />
      <PwaModal />
    </>
  )
}
