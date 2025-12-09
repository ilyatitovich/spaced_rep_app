import type { ChangeEvent, FormEvent } from 'react'
import { memo, useCallback, useState } from 'react'
import { toast } from 'react-hot-toast'

import { BackButton, Button, Header, Screen } from '@/components'
import { TITLE_MAX_LENGTH } from '@/lib'
import { Topic } from '@/models'
import { useScreenStore } from '@/stores'
import { useTopicStore } from '@/stores/topic.store'

export default memo(function CreateTopic() {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const isOpen = useScreenStore(s => s.isCreateOpen)

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value)
      if (error) setError('')
    },
    [error]
  )

  const handleSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError('')

      const trimmed = title.trim()
      if (!trimmed) return setError('Please enter a title for the topic')
      if (trimmed.length > TITLE_MAX_LENGTH)
        return setError(
          `Title must be less than ${TITLE_MAX_LENGTH} characters`
        )

      try {
        await useTopicStore.getState().addNewTopic(new Topic(trimmed))
        toast.success('Topic created!')
        setTitle('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Please try again')
        toast.error('Please try again')
      }
    },
    [title]
  )
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
})
