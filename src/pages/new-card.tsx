import { useState, useEffect, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { Card as CardModel } from '@/models'
import { createCard } from '@/services'
import { useTopicStore } from '@/stores'

export default function NewCard() {
  const navigate = useNavigate()

  const { currentTopic } = useTopicStore()

  const [isFlipped, setIsFlipped] = useState<boolean>(false)
  const [cardData, setCardData] = useState({ front: '', back: '' })
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isEdited, setIsEdited] = useState<boolean>(false)
  const [isDraft, setIsDraft] = useState<boolean>(true)

  const cardDataIsExist = cardData.front && cardData.back

  const rightBtn = isDraft ? (
    isEdited ? (
      <Button key="done" onClick={() => setIsEdited(false)}>
        Done
      </Button>
    ) : (
      <Button
        key="save-draft"
        onClick={() => handleSaveCard('draft')}
        disabled={!!cardData.front === false}
      >
        Save Draft
      </Button>
    )
  ) : isEdited ? (
    <Button key="done" onClick={() => setIsEdited(false)}>
      Done
    </Button>
  ) : (
    <Button key="save" onClick={() => handleSaveCard('new')}>
      Save
    </Button>
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSaveCard = async (cardStatus: 'new' | 'draft') => {
    try {
      const testCard = new CardModel(
        cardData,
        currentTopic!.id,
        cardStatus === 'new' ? 0 : -1
      )
      await createCard(testCard)

      setIsSaving(true)
      setCardData({ front: '', back: '' })
      setIsFlipped(false)
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  return (
    <main>
      <Navbar>
        <Button
          onClick={() => {
            navigate(-1)
          }}
        >
          Back
        </Button>
        <p>{isFlipped ? 'Back' : 'Front'}</p>
        {rightBtn}
      </Navbar>
      <Content centered>
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
      </Content>
      <footer>
        <Button onClick={() => setIsFlipped(!isFlipped)}>Flip</Button>
      </footer>
    </main>
  )
}
