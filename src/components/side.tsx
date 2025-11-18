import type { FocusEventHandler, FocusEvent, FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

import type { CardSide } from '@/types'

type SideProps = {
  side: CardSide
  content?: string | File
  isEditable?: boolean
  handleFocus?: FocusEventHandler<HTMLDivElement>
  handleBlur?: FocusEventHandler<HTMLDivElement>
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
  const [isLongText, setIsLongText] = useState(false)

  const handleInput = useCallback((e: FormEvent<HTMLDivElement>) => {
    setIsLongText(e.currentTarget.innerText.length > 80)
  }, [])

  useEffect(() => {
    if (typeof content === 'string') {
      setIsLongText(content.length > 80)
    }
  }, [content])

  const handleContainerClick = useCallback(() => {
    if (
      document.activeElement !== innerRef?.current &&
      innerRef?.current &&
      isEditable
    ) {
      innerRef.current.focus()
    }
  }, [innerRef, isEditable])

  const placeCursorAtEnd = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const range = document.createRange()
    const sel = window.getSelection()
    if (!sel) return
    range.selectNodeContents(event.target)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={`absolute w-full h-full p-4 backface-hidden ${isLongText ? 'overflow-y-auto scrollbar-hidden' : 'flex justify-center items-center'} border-black border-6 rounded-4xl bg-white ${side === 'back' ? 'rotate-y-180' : ''}`.trim()}
      onClick={handleContainerClick}
    >
      <div
        ref={innerRef}
        className={`w-full outline-none whitespace-pre-wrap break-words text-center ${isLongText ? 'text-3xl' : 'text-4xl font-bold font-card leading-13'} `}
        contentEditable={isEditable}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        onFocus={e => {
          handleFocus?.(e)
          placeCursorAtEnd(e)
        }}
        onBlur={handleBlur}
        onInput={handleInput}
      >
        {typeof content === 'string' ? content : ''}
      </div>
    </div>
  )
}
