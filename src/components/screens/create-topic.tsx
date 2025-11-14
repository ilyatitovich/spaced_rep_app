import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'

import { Button, Content } from '@/components'
import { Topic } from '@/models'
import { createTopic } from '@/services'

type CreateTopicProps = {
  isOpen: boolean
  onClose: () => void
}

const CHARS_LIMIT = 50

export default function CreateTopic({ isOpen, onClose }: CreateTopicProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (error) setError('')
  }

  const handleSave = async (e: FormEvent) => {
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

    const topic = new Topic(title.trim())

    try {
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

  const handleClose = () => {
    setTitle('')
    setError('')
    onClose()
  }

  return (
    <div
      className={`${isOpen ? 'translate-y-0' : 'translate-y-full'} transition-transform duration-300 ease-in-out fixed inset-0 z-50`}
    >
      {isOpen && <Toaster position="top-center" reverseOrder={false} />}
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <Button onClick={handleClose}>Close</Button>
          <Button disabled={!title} onClick={handleSave}>
            Save
          </Button>
        </div>

        <Content>
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

            <p className="text-gray-500 text-sm leading-snug">
              Choose a short, clear name. This will be shown in your topics
              list.
            </p>
          </form>
        </Content>
      </div>
    </div>
  )
}
