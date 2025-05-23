import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

import { Button, Navbar, Content } from '@/components'
import { TopicModel } from '@/lib/models'
import { saveTopic, getNextUpdateDate } from '@/lib/utils'
import { createTopic } from '@/services'

export default function NewTopic() {
  const [title, setTitle] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (error) setError(null)
    if (confirmation) setConfirmation(false)
  }

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    setConfirmation(false)

    if (!trimmedTitle) {
      setError('Title cannot be empty')
      return
    }

    if (trimmedTitle.length > 10) {
      setError('Title cannot exceed 10 characters. Try a shorter title')
      return
    }

    const topic = new TopicModel(uuidv4(), trimmedTitle, getNextUpdateDate())

    try {
      saveTopic(topic) // Temp save the topic to local storage
      await createTopic(topic)
      setConfirmation(true)
      setError(null)
      setTitle('')
    } catch (err) {
      setConfirmation(false)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        console.error('Unexpected error:', err)
        setError('An unexpected error occurred, please try again')
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <main>
      <Navbar>
        <Button href="/">Back</Button>
        <Button disabled={!title} onClick={handleSave}>
          Save
        </Button>
      </Navbar>

      <Content>
        <form
          className="flex flex-col items-center justify-center gap-6 h-full"
          onSubmit={e => e.preventDefault()}
        >
          <label htmlFor="title" className="text-2xl">
            What are you going to learn?
          </label>

          <div className="flex flex-col justify-center gap-4 w-full">
            <input
              id="title"
              name="title"
              value={title}
              onChange={handleTitleChange}
              onKeyDown={handleKeyDown}
              className="p-4 rounded-xl border-2 border-black focus:border-blue focus:outline-none"
              placeholder="Enter a topic title"
            />

            {confirmation && (
              <span className="text-green text-center">
                Topic saved successfully!
              </span>
            )}

            {error && <span className="text-red text-center">{error}</span>}
          </div>
        </form>
      </Content>
    </main>
  )
}
