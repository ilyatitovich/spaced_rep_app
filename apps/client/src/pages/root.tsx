import { Outlet } from 'react-router'

import { DesktopMessage, PwaModal } from '@/components'
import { useIsMobile } from '@/hooks'

export default function Root() {
  const isMobile = useIsMobile()

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
