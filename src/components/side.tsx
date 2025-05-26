import type { FocusEventHandler } from 'react'

import type { CardSide } from '@/types'

type SideProps = {
  side: CardSide
  content?: string | File
  isEditable?: boolean
  handleFocus?: FocusEventHandler<HTMLElement>
  handleBlur?: FocusEventHandler<HTMLElement>
  innerRef?: React.RefObject<HTMLDivElement>
}

export default function Side({
  side,
  content,
  isEditable,
  handleFocus,
  handleBlur,
  innerRef
}: SideProps) {
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
