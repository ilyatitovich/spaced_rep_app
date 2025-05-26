/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import type { FocusEventHandler, Ref } from 'react'
import { forwardRef, useRef, useImperativeHandle } from 'react'

type CardSide = 'front' | 'back'

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

type CardHandle = {
  getContent: () => { front: string; back: string }
}

function Side({
  side,
  content,
  isEditable,
  handleFocus,
  handleBlur,
  innerRef
}: {
  side: CardSide
  content?: string | File
  isEditable?: boolean
  handleFocus?: FocusEventHandler<HTMLElement>
  handleBlur?: FocusEventHandler<HTMLElement>
  innerRef?: React.RefObject<HTMLDivElement>
}) {
  return (
    <div
      ref={innerRef}
      className={`absolute w-full h-full py-[1.5em] px-[1em] backface-hidden border-black border-4 rounded-4xl bg-white ${side === 'back' ? 'rotate-y-180' : ''}`.trim()}
      contentEditable={isEditable}
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {typeof content === 'string' ? content : ''}
    </div>
  )
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

  useImperativeHandle(ref, () => ({
    getContent: () => ({
      front: frontRef.current?.innerText || '',
      back: backRef.current?.innerText || ''
    })
  }))

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className={`perspective-[1000px] w-[80vw] h-[70vh] absolute ${className}`.trim()}
      onClick={handleClick}
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
