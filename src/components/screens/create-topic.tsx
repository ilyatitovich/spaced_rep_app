import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'

import { BackButton, Button, Header, Screen } from '@/components'
import { useTopic } from '@/contexts'
import { TITLE_MAX_LENGTH } from '@/lib'
import { Topic } from '@/models'

type CreateTopicProps = {
  isOpen: boolean
}

export default function CreateTopic({ isOpen }: CreateTopicProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const { addNewTopic } = useTopic()

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.trim())
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
      await addNewTopic(new Topic(title))
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
