import { useState } from 'react'

import { Button, Navbar, Content } from '@/components'
import { Topic } from '@/models'
import { createTopic } from '@/services'

type CreateTopicProps = {
  handleClose: () => void
}

export default function CreateTopic({ handleClose }: CreateTopicProps) {
  const [title, setTitle] = useState('')

  const [status, setStatus] = useState<{
    isError: boolean
    message: string
  } | null>(null)

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.trim())
    if (status) setStatus(null)
  }

  const handleSave = async () => {
    setStatus(null)

    if (!title) {
      setStatus({
        isError: true,
        message: 'Please enter a title for the topic'
      })
      return
    }

    if (title.length > 10) {
      setStatus({
        isError: true,
        message: 'Title must be less than 10 characters'
      })
      return
    }

    const topic = new Topic(title)

    try {
      await createTopic(topic)
      setStatus({
        isError: false,
        message: 'Topic saved successfully!'
      })
      setTitle('')
    } catch (error) {
      if (error instanceof Error) {
        setStatus({
          isError: true,
          message: error.message
        })
      } else {
        setStatus({
          isError: true,
          message: 'An unexpected error occurred, please try again'
        })
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
        <Button onClick={handleClose}>Back</Button>
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

            {status && (
              <span
                className={`${status.isError ? 'text-red' : 'text-green'} text-center`}
              >
                {status.message}
              </span>
            )}
          </div>
        </form>
      </Content>
    </main>
  )
}
