import type { FocusEventHandler, Ref } from 'react'
import { forwardRef, useRef, useImperativeHandle } from 'react'

import Side from './side'
import { useTap } from '@/hooks'
import type { CardData, CardHandle, SideContentType, SideName } from '@/types'

type CardProps = {
  data: CardData
  sidesContentType?: {
    front: SideContentType
    back: SideContentType
  }
  isFlipped: boolean
  isEditable?: boolean
  className?: string
  handleFocus?: FocusEventHandler<HTMLElement>
  handleBlur?: FocusEventHandler<HTMLElement>
  handleClick?: () => void
  handleChange?: (
    value: string | Blob,
    type: SideContentType,
    side: SideName
  ) => void
}

export default forwardRef(function Card(
  {
    data,
    sidesContentType,
    isFlipped,
    className = '',
    isEditable = false,
    handleClick,
    handleBlur,
    handleFocus,
    handleChange
  }: CardProps,
  ref: Ref<CardHandle>
) {
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  const { onTouchStart, onTouchEnd } = useTap(handleClick)

  useImperativeHandle(ref, () => ({
    getContent: () => ({
      front: {
        side: 'front',
        type: sidesContentType?.front ?? 'text',
        content: frontRef.current?.innerText.trim() || ''
      },
      back: {
        side: 'back',
        type: sidesContentType?.back ?? 'text',
        content: backRef.current?.innerText.trim() || ''
      }
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
          data={data.front}
          contentType={sidesContentType?.front}
          isEditable={isEditable}
          innerRef={frontRef}
          handleBlur={handleBlur}
          handleFocus={handleFocus}
          onChange={handleChange}
        />
        <Side
          data={data.back}
          contentType={sidesContentType?.back}
          isEditable={isEditable}
          innerRef={backRef}
          handleBlur={handleBlur}
          handleFocus={handleFocus}
          onChange={handleChange}
        />
      </div>
    </div>
  )
})
