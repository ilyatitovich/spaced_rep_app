import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useState } from 'react'
import { toast } from 'react-hot-toast'

import { BackButton, Button, Header, Screen } from '@/components'
import { TITLE_MAX_LENGTH } from '@/lib'

import { createTopic } from '@/services'
import { getNextUpdateDate, setStartWeek, type Topic } from '@/models'

type CreateTopicProps = {
  isOpen: boolean
  onCreate: (topic: Topic) => void
}

export default function CreateTopic({ isOpen, onCreate }: CreateTopicProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (error) setError('')
  }

  const handleSave = async (e: FormEvent): Promise<void> => {
    if (typeof e !== 'undefined') {
      e.preventDefault()
    }

    setError('')

    if (!title) {
      setError('Please enter a title for the topic')
      return
    }

    if (title.length > TITLE_MAX_LENGTH) {
      setError(`Title must be less than ${TITLE_MAX_LENGTH} characters`)
      return
    }

    try {
      const pivot = Date.now()

      const topic = {
        id: crypto.randomUUID(),
        title: title.trim(),
        pivot: pivot,
        week: setStartWeek(pivot),
        nextUpdateDate: getNextUpdateDate(),
        updatedAt: pivot,
        deletedAt: null
      }

      await createTopic(topic)
      onCreate(topic)
      toast.success('Topic created!')
      setTitle('')
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      }
      toast.error('Please try again')
    }
  }

  const handleClose = useCallback(() => {
    setTitle('')
    setError('')
    toast.dismissAll()
  }, [])

  return (
    <Screen isOpen={isOpen} onClose={handleClose} isVertical>
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <Header>
          <BackButton />
          <Button disabled={!title} onClick={handleSave}>
            Save
          </Button>
        </Header>

        <form onSubmit={handleSave} className="flex flex-col gap-6 mt-8 px-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="text-lg font-medium">
              Topic title
            </label>

            <input
              id="title"
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. Spanish Basics"
              className="w-full p-4 rounded-xl border border-border focus:border-input-focus focus:outline-none transition"
            />

            {error && <span className="text-danger text-sm">{error}</span>}
          </div>

          <p className="text-foreground-muted text-sm">
            Choose a short, clear name. This will be shown in your topics list.
          </p>
        </form>
      </div>
    </Screen>
  )
}
