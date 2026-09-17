import { Outlet } from 'react-router'

import { PwaModal } from '@/components'
import { useKeyboardManager } from '@/hooks'

export default function Root() {
  useKeyboardManager()

  return (
    <>
      <Outlet />
      <PwaModal />
    </>
  )
}
