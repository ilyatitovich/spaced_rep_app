import './NewCard.scss'

import { Topic } from '@/types'
import { useState, useEffect, type ChangeEvent } from 'react'
import { useLoaderData, useNavigate } from 'react-router'

import Card from '../../components/Card/Card'
import { saveTopic } from '../../lib/utils'

export default function NewCard() {
  const navigate = useNavigate()
  const { topic } = useLoaderData() as { topic: Topic }
  const [isFlipped, setIsFlipped] = useState<boolean>(false)
  const [cardData, setCardData] = useState({ front: '', back: '' })
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isEdited, setIsEdited] = useState<boolean>(false)
  const [isDraft, setIsDraft] = useState<boolean>(true)

  const { levels, draft } = topic
  const firstLevelCards = levels[0].cards
  const cardDataIsExist = cardData.front && cardData.back

  const rightBtn = isDraft ? (
    isEdited ? (
      <button key="done" onClick={() => setIsEdited(false)}>
        Done
      </button>
    ) : (
      <button
        key="save-draft"
        onClick={() => handleSaveCard('draft')}
        disabled={!!cardData.front === false}
      >
        Save Draft
      </button>
    )
  ) : isEdited ? (
    <button key="done" onClick={() => setIsEdited(false)}>
      Done
    </button>
  ) : (
    <button key="save" onClick={() => handleSaveCard('new')}>
      Save
    </button>
  )

  useEffect(() => {
    if (cardDataIsExist) {
      setIsDraft(false)
    } else {
      setIsDraft(true)
    }
  }, [cardDataIsExist])

  useEffect(() => {
    let timer: NodeJS.Timeout

    if (isSaving) {
      timer = setTimeout(() => {
        setIsSaving(false)
      }, 100)
    }

    return () => {
      clearTimeout(timer)
    }
  }, [isSaving])

  function handleChange(
    event: ChangeEvent<HTMLTextAreaElement>,
    side: 'front' | 'back'
  ) {
    switch (side) {
      case 'front':
        setCardData({
          ...cardData,
          front: event.target.value
        })
        break
      case 'back':
        setCardData({
          ...cardData,
          back: event.target.value
        })
        break
      default:
        return
    }
  }

  function handleSaveCard(cardStatus: 'new' | 'draft') {
    const cardForSave = {
      id: firstLevelCards.length,
      level: 0,
      ...cardData
    }

    if (cardStatus === 'new') {
      firstLevelCards.push(cardForSave)
    } else {
      draft.push(cardForSave)
    }

    saveTopic(topic)
    setIsSaving(true)
    setCardData({ front: '', back: '' })
    setIsFlipped(false)
  }

  return (
    <div className="new-card">
      <nav>
        <button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </button>
        <p>{isFlipped ? 'Back' : 'Front'}</p>
        {rightBtn}
      </nav>
      <div className="card-container">
        {!isSaving && (
          <Card
            data={cardData}
            isFlipped={isFlipped}
            isEditable={true}
            handleFocus={() => setIsEdited(true)}
            handleBlur={() => setIsEdited(false)}
            handleChange={handleChange}
          />
        )}
      </div>
      <footer>
        <button onClick={() => setIsFlipped(!isFlipped)}>Flip</button>
      </footer>
    </div>
  )
}
