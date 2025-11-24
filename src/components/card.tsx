import type { FocusEventHandler, Ref } from 'react'
import { forwardRef, useRef, useImperativeHandle } from 'react'

import Side from './side'
import { useTap } from '@/hooks'
import type { CardHandle, CardSide } from '@/types'

type CardProps = {
  data: { front: File | string; back: File | string }
  isFlipped: boolean
  isEditable?: boolean
  className?: string
  handleFocus?: FocusEventHandler<HTMLElement>
  handleBlur?: FocusEventHandler<HTMLElement>
  handleClick?: () => void
  handleChange?: (data: string, side: CardSide) => void
}

export default forwardRef(function Card(
  {
    data,
    isFlipped,
    className = '',
    isEditable = false,
    handleClick,
    handleBlur,
    handleFocus
  }: CardProps,
  ref: Ref<CardHandle>
) {
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  const { onTouchStart, onTouchEnd } = useTap(handleClick)

  useImperativeHandle(ref, () => ({
    getContent: () => ({
      front: frontRef.current?.innerText.trim() || '',
      back: backRef.current?.innerText.trim() || ''
    }),
    resetContent: () => {
      if (frontRef.current) frontRef.current.innerText = ''
      if (backRef.current) backRef.current.innerText = ''
    }
  }))

  return (
    <div
      className={`perspective-[1000px] w-[80vw] max-w-[300px] h-[60dvh] absolute ${className}`.trim()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={`w-full h-full relative transform-style-preserve-3d transition-transform duration-600 ${
          isFlipped ? 'rotate-y-180' : ''
        }`.trim()}
      >
        <Side
          side="front"
          content={data['front']}
          isEditable={isEditable}
          innerRef={frontRef}
          handleBlur={handleBlur}
          handleFocus={handleFocus}
        />
        <Side
          side="back"
          content={data['back']}
          isEditable={isEditable}
          innerRef={backRef}
          handleBlur={handleBlur}
          handleFocus={handleFocus}
        />
      </div>
    </div>
  )
})
