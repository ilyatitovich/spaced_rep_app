import type { FocusEventHandler, Ref } from 'react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import Side, { type SideHandle } from './side'
import { useTap } from '@/hooks'
import { normalizeCardData } from '@/lib'
import type { CardData, CardHandle, SideBlock, SideName } from '@/types'

type CardProps = {
  data: CardData | unknown
  isFlipped: boolean
  isEditable?: boolean
  autoFocus?: boolean
  className?: string
  handleFocus?: FocusEventHandler<HTMLElement>
  handleBlur?: FocusEventHandler<HTMLElement>
  handleClick?: () => void
  handleChange?: (blocks: SideBlock[], side: SideName) => void
}

export default forwardRef(function Card(
  {
    data,
    isFlipped,
    className = '',
    isEditable = false,
    autoFocus = false,
    handleClick,
    handleBlur,
    handleFocus,
    handleChange
  }: CardProps,
  ref: Ref<CardHandle>
) {
  const frontRef = useRef<SideHandle>(null)
  const backRef = useRef<SideHandle>(null)
  const normalized = normalizeCardData(data)

  const { onTouchStart, onTouchEnd } = useTap(handleClick)

  useImperativeHandle(ref, () => ({
    getContent: () => ({
      front: {
        side: 'front',
        blocks: frontRef.current?.getBlocks() ?? normalized.front.blocks
      },
      back: {
        side: 'back',
        blocks: backRef.current?.getBlocks() ?? normalized.back.blocks
      }
    }),
    resetContent: () => {
      frontRef.current?.reset()
      backRef.current?.reset()
    },
    focusContent: (side: SideName, which: 'first' | 'last' = 'first') => {
      const sideRef = side === 'front' ? frontRef : backRef
      if (which === 'last') sideRef.current?.focusLastText()
      else sideRef.current?.focusFirstText()
    }
  }))

  useEffect(() => {
    if (!isEditable || !autoFocus) return
    const id = requestAnimationFrame(() => {
      if (isFlipped) backRef.current?.focusFirstText()
      else frontRef.current?.focusFirstText()
    })
    return () => cancelAnimationFrame(id)
  }, [isEditable, autoFocus, isFlipped])

  return (
    <div
      className={`perspective-[1000px] w-[80vw] max-w-[350px] h-[60dvh] max-h-[500px] absolute ${className}`.trim()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={`w-full h-full relative transform-style-preserve-3d transition-transform duration-600 ${
          isFlipped ? 'rotate-y-180' : ''
        }`.trim()}
      >
        <Side
          ref={frontRef}
          data={normalized.front}
          isEditable={isEditable}
          isVisible={!isFlipped}
          handleBlur={handleBlur}
          handleFocus={handleFocus}
          onChange={handleChange}
        />
        <Side
          ref={backRef}
          data={normalized.back}
          isEditable={isEditable}
          isVisible={isFlipped}
          handleBlur={handleBlur}
          handleFocus={handleFocus}
          onChange={handleChange}
        />
      </div>
    </div>
  )
})
