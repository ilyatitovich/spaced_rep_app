import { motion } from 'framer-motion'
import type { ChangeEvent, FocusEventHandler } from 'react'

type CardSide = 'front' | 'back'

type CardProps = {
  data: { front: string; back: string }
  isFlipped: boolean
  isEditable?: boolean
  handleFocus?: FocusEventHandler<HTMLTextAreaElement>
  handleBlur?: FocusEventHandler<HTMLTextAreaElement>
  handleClick?: () => void
  handleChange?: (
    event: ChangeEvent<HTMLTextAreaElement>,
    side: CardSide
  ) => void
}

const baseFaceStyles =
  'w-full h-full flex justify-center items-center text-[2rem] text-center p-[1.5em] leading-[1.5] border-none shadow-none outline-none absolute backface-hidden rounded-[1em] bg-white'

const backFaceModifier = '-rotate-y-180'

export default function Card({
  data,
  isFlipped,
  isEditable = false,
  handleFocus,
  handleBlur,
  handleClick,
  handleChange
}: CardProps) {
  const renderSide = (side: CardSide, isBack = false) => {
    const content = data[side]

    const commonProps = {
      className: `${baseFaceStyles} ${isBack ? backFaceModifier : ''}`
    }

    if (!isEditable) {
      return <div {...commonProps}>{content}</div>
    }

    return (
      <textarea
        {...commonProps}
        value={content}
        maxLength={70}
        onChange={e => handleChange?.(e, side)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    )
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="flex justify-center items-center"
      onClick={handleClick}
    >
      <div className="perspective-[1000px] w-[80vw] h-[70vh] relative">
        <div
          className={`w-full h-full transform-style-preserve-3d transition-transform duration-600 rounded-[1.5em] border-[4px] border-black ${
            isFlipped ? '-rotate-y-180' : ''
          }`}
        >
          {renderSide('front')}
          {renderSide('back', true)}
        </div>
      </div>
    </motion.div>
  )
}
