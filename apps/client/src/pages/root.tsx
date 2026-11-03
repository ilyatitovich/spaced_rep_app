import { Outlet } from 'react-router'

import { DesktopFrame, PwaModal, ProUpgradeOnSignIn } from '@/components'
import { useKeyboardManager } from '@/hooks'

export default function Root() {
  useKeyboardManager()

  return (
    <>
      <DesktopFrame />
      <Outlet />
      <PwaModal />
      <ProUpgradeOnSignIn />
    </>
  )
}
