import './Card.scss'

import { motion } from 'motion/react'
import { type ChangeEvent, useRef, useEffect } from 'react'

import { type CardModelData } from '@/models'

interface CardProps {
  data: CardModelData
  isFlipped: boolean
  isEditable?: boolean
  isEdited?: boolean
  handleFocus?: () => void
  handleBlur?: () => void
  handleClick?: () => void
  handleChange?: (
    event: ChangeEvent<HTMLTextAreaElement>,
    side: 'front' | 'back'
  ) => void
}

export default function Card({
  data,
  isFlipped,
  isEditable = false,
  isEdited = false,
  handleFocus,
  handleBlur,
  handleClick,
  handleChange = () => {}
}: CardProps) {
  const frontTextRef = useRef<HTMLTextAreaElement>(null)
  const backTextRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isEdited) {
      return
    }

    const ref = isFlipped ? backTextRef.current : frontTextRef.current
    ref?.focus()
  }, [isEdited, isFlipped])

  let content = (
    <>
      {data.front instanceof File ? (
        <div className="front">
          <img src={URL.createObjectURL(data.front)} alt={data.front.name} />
        </div>
      ) : (
        <div className="front">{data.front}</div>
      )}

      {data.back instanceof File ? (
        <div className="back">
          <img src={URL.createObjectURL(data.back)} alt={data.back.name} />
        </div>
      ) : (
        <div className="back">{data.back}</div>
      )}
    </>
  )

  if (isEditable) {
    content = (
      <>
        {data.front instanceof File ? (
          <div className="front">
            <img src={URL.createObjectURL(data.front)} alt={data.front.name} />
          </div>
        ) : (
          <textarea
            ref={frontTextRef}
            className="front"
            value={data.front}
            onChange={event => handleChange(event, 'front')}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        )}

        {data.back instanceof File ? (
          <div className="back">
            <img src={URL.createObjectURL(data.back)} alt={data.back.name} />
          </div>
        ) : (
          <textarea
            ref={backTextRef}
            className="back"
            value={data.back}
            onChange={event => handleChange(event, 'back')}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        )}
      </>
    )
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="card-wrapper"
      onClick={handleClick}
    >
      <div className="card">
        <div className={`inner ${isFlipped ? 'flipped' : ''}`}>{content}</div>
      </div>
    </motion.div>
  )
}
