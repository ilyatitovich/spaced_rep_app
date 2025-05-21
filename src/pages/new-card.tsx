import { useState, useEffect, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button, Navbar, Content, Card } from '@/components'
import { Topic } from '@/lib/definitions'
import { saveTopic } from '@/lib/utils'
import { useTopicStore } from '@/stores'

export default function NewCard() {
  const navigate = useNavigate()
  const topic = useTopicStore(state => state.topic)
  const [isFlipped, setIsFlipped] = useState<boolean>(false)
  const [cardData, setCardData] = useState({ front: '', back: '' })
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isEdited, setIsEdited] = useState<boolean>(false)
  const [isDraft, setIsDraft] = useState<boolean>(true)

  const { levels, draft } = topic as Topic
  const firstLevelCards = levels[0].cards
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

    saveTopic(topic!)
    setIsSaving(true)
    setCardData({ front: '', back: '' })
    setIsFlipped(false)
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
