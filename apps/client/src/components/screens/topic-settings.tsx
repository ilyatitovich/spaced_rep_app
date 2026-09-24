import { Archive, ArchiveRestore, Pencil, Share, Trash } from 'lucide-react'
import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

import {
  BackButton,
  ConfirmDeleteModal,
  Header,
  Screen,
  Button
} from '@/components'
import { TITLE_MAX_LENGTH } from '@/lib'
import type { Topic } from '@/models'
import { shareTopic } from '@/services'
import { useTopicsStore } from '@/store'

type TopicSettingsProps = {
  isOpen: boolean
  topic: Topic
  onClose: () => void
}

export default function TopicSettings({
  isOpen,
  topic,
  onClose
}: TopicSettingsProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] =
    useState(false)

  const deleteTopics = useTopicsStore(state => state.deleteTopics)
  const updateTopic = useTopicsStore(state => state.updateTopic)
  const archiveTopics = useTopicsStore(state => state.archiveTopics)
  const unarchiveTopics = useTopicsStore(state => state.unarchiveTopics)

  useEffect(() => {
    if (isOpen) {
      setTitle(topic.title)
    }
  }, [isOpen, topic.title])

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
      topic.title = title
      await updateTopic(topic)
      toast.success('Title updated!')
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
    setIsConfirmDeleteModalOpen(false)
    toast.dismissAll()
  }, [])

  const isDisabled = (): boolean => {
    return !title || title === topic.title
  }

  const handleDeleteTopic = async (): Promise<void> => {
    if (!topic) return
    try {
      await deleteTopics(topic.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete topic.', error)
    }
  }

  const handleShareTopic = async (): Promise<void> => {
    try {
      await shareTopic(topic)
    } catch {
      toast.error('Failed to share topic')
    }
  }

  const handleToggleArchive = async (): Promise<void> => {
    try {
      if (topic.isArchived) {
        await unarchiveTopics(topic.id)
        toast.success('Topic unarchived')
      } else {
        await archiveTopics(topic.id)
        toast.success('Topic archived')
      }
      onClose()
    } catch (error) {
      console.error('Failed to update archive state:', error)
      toast.error('Please try again')
    }
  }

  return (
    <Screen isOpen={isOpen} onClose={handleClose}>
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <Header>
          <BackButton />
          <span className="font-bold">Settings</span>
        </Header>

        <div className="flex flex-col gap-8 px-4">
          <form onSubmit={handleSave} className="flex flex-col gap-6 mt-8">
            <div className="flex flex-col gap-2">
              <label htmlFor="title" className="font-bold">
                Topic title
              </label>
              <div className="flex gap-2">
                <input
                  id="title"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="e.g. Spanish Basics"
                  className="w-full p-4 rounded-xl border border-border focus:border-input-focus focus:outline-none transition"
                />

                <Button
                  type="submit"
                  variant="primary"
                  disabled={isDisabled()}
                  className="p-4 rounded-xl"
                  size="none"
                  aria-label="Save title"
                >
                  <Pencil className="text-primary-foreground" strokeWidth={3} />
                </Button>
              </div>
              {error && <span className="text-danger text-sm">{error}</span>}
            </div>
          </form>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={handleShareTopic}
            >
              <Share size={18} />
              <span>Share topic</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={handleToggleArchive}
            >
              {topic.isArchived ? (
                <>
                  <ArchiveRestore size={18} />
                  <span>Unarchive topic</span>
                </>
              ) : (
                <>
                  <Archive size={18} />
                  <span>Archive topic</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="absolute bottom-0 w-full p-4 flex justify-center items-center">
          <Button
            variant="dangerLink"
            className="flex-col gap-2"
            onClick={() => setIsConfirmDeleteModalOpen(true)}
          >
            <span>
              <Trash />
            </span>
            <span className="text-xs">Delete</span>
          </Button>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteModalOpen}
        onConfirm={handleDeleteTopic}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        count={1}
        itemName="topic"
      />
    </Screen>
  )
}
