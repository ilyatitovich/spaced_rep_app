import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import Button from './button'

type OpenButtonProps = {
  param: 'topicSettings' | 'addCard' | 'test' | 'levelId' | 'cardId'
  value?: string
  children: ReactNode
}

export default function BackButton({
  param,
  value = 'true',
  children
}: OpenButtonProps) {
  const [, setSearchParams] = useSearchParams()

  return (
    <Button
      onClick={() => {
        setSearchParams(prev => {
          const params = new URLSearchParams(prev)
          params.set(param, value)
          return params
        })
      }}
    >
      {children}
    </Button>
  )
}
