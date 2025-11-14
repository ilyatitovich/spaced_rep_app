import type { ChangeEvent } from 'react'
import { useState } from 'react'
// import { Toaster, toast } from 'react-hot-toast'

import { Button, Navbar, Content } from '@/components'
import { Topic } from '@/models'
import { createTopic } from '@/services'

type CreateTopicProps = {
  handleClose: () => void
}

export default function CreateTopic({ handleClose }: CreateTopicProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.trim())
    if (error) setError('')
  }

  const handleSave = async () => {
    setError('')

    if (!title) {
      setError('Please enter a title for the topic')
      return
    }

    if (title.length > 10) {
      setError('Title must be less than 10 characters')
      return
    }

    const topic = new Topic(title)

    try {
      await createTopic(topic)
      // toast.success('Topic created!', {
      //   iconTheme: {
      //     primary: 'green',
      //     secondary: 'white'
      //   }
      // })
      setTitle('')
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      }
      // toast.error('Please try again')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      {/* <Toaster position="top-center" reverseOrder={false} /> */}
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

            {error && <span className="text-red text-center">{error}</span>}
          </div>
        </form>
      </Content>
    </div>
  )
}
