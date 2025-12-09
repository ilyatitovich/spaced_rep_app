import type { ReactNode } from 'react'

import Button from './button'
import { Screen, useScreenStore } from '@/stores'

type OpenButtonProps = {
  screen: Screen
  children: ReactNode
}

export default function BackButton({ screen, children }: OpenButtonProps) {
  return (
    <Button onClick={() => useScreenStore.getState().openScreen(screen)}>
      {children}
    </Button>
  )
}
