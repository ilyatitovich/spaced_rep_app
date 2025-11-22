import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'

import { BackButton, Button, Screen } from '@/components'
import { Topic } from '@/models'
import { createTopic } from '@/services'

type CreateTopicProps = {
  isOpen: boolean
}

const CHARS_LIMIT = 50

export default function CreateTopic({ isOpen }: CreateTopicProps) {
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

    if (title.length > CHARS_LIMIT) {
      setError(`Title must be less than ${CHARS_LIMIT} characters`)
      return
    }

    try {
      const topic = new Topic(title.trim())
      await createTopic(topic)
      toast.success('Topic created!', {
        iconTheme: {
          primary: 'green',
          secondary: 'white'
        }
      })
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
      {isOpen && <Toaster position="top-center" reverseOrder={false} />}
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4">
          <BackButton />
          <Button disabled={!title} onClick={handleSave}>
            Save
          </Button>
        </div>

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
              className="w-full p-4 rounded-xl border border-gray-300 focus:border-purple-600 focus:outline-none transition"
            />

            {error && <span className="text-red-600 text-sm">{error}</span>}
          </div>

          <p className="text-gray-500 text-sm">
            Choose a short, clear name. This will be shown in your topics list.
          </p>
        </form>
      </div>
    </Screen>
  )
}
