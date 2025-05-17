import './AddCard.css'

import { AnimatePresence } from 'motion/react'
import { useState, useEffect, type ChangeEvent } from 'react'
import { useLoaderData, useNavigate, useSearchParams } from 'react-router'

import { Card, Header, Footer, ImageForm } from '@/components'
import { saveTopic } from '@/lib/db'
import { Topic, CardModel, type CardModelData } from '@/models'

export default function AddCard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { topic } = useLoaderData<{ topic: Topic }>()

  const [isFlipped, setIsFlipped] = useState(false)
  const [cardData, setCardData] = useState<CardModelData>({
    front: '',
    back: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isEdited, setIsEdited] = useState(false)
  const [isDraft, setIsDraft] = useState(true)

  const { levels, draft } = topic
  const firstLevelCards = levels[0].cards

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
    if (cardData.front && cardData.back) {
      setIsDraft(false)
    } else {
      setIsDraft(true)
    }
  }, [cardData])

  function handleChange(
    event: ChangeEvent<HTMLTextAreaElement>,
    side: 'front' | 'back'
  ): void {
    setCardData(prev => ({ ...prev, [side]: event.target.value }))
  }

  async function handleSaveCard(cardStatus: 'new' | 'draft') {
    const card = new CardModel(cardData)

    if (cardStatus === 'new') {
      firstLevelCards.push(card)
    } else {
      draft.push(card)
    }

    setIsSaving(true)
    await saveTopic(topic)
    setCardData({ front: '', back: '' })
    setIsFlipped(false)
    setIsSaving(false)
  }

  function openImageForm(): void {
    setSearchParams({ imgForm: 'open' })
  }

  function setImage(image: File): void {
    setCardData(prev => ({
      ...prev,
      [isFlipped ? 'back' : 'front']: image
    }))
  }

  function handleText(): void {
    setCardData(prev => ({
      ...prev,
      [isFlipped ? 'back' : 'front']: ''
    }))

    setIsEdited(true)
  }

  return (
    <>
      <main className="add-card">
        <Header>
          <button onClick={() => navigate(-1)}>Back</button>
          <h1>{isFlipped ? 'Back' : 'Front'}</h1>
          {rightBtn}
        </Header>

        <section className="add-card__content">
          {!isSaving && (
            <Card
              data={cardData}
              isFlipped={isFlipped}
              isEditable={true}
              isEdited={isEdited}
              handleFocus={() => setIsEdited(true)}
              handleBlur={() => setIsEdited(false)}
              handleChange={handleChange}
            />
          )}
        </section>

        <section className="add-card__modes">
          <ul>
            <li>
              <button onClick={handleText}>text</button>
            </li>
            <li>
              <button onClick={openImageForm}>img</button>
            </li>
            <li>code</li>
          </ul>
        </section>

        <Footer>
          <button onClick={() => setIsFlipped(prev => !prev)}>Flip</button>
        </Footer>
      </main>
      <AnimatePresence>
        {searchParams.get('imgForm') && (
          <ImageForm handleSave={(image: File) => setImage(image)} />
        )}
      </AnimatePresence>
    </>
  )
}
