import { ArrowUpFromLine, Download, Pencil, Trash } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { useSearchParams } from 'react-router'

import {
  BackButton,
  ConfirmDeleteModal,
  ExportTopicModal,
  Header,
  ImportCardsModal,
  Screen
} from '@/components'
import { useTopic } from '@/contexts'
import { TITLE_MAX_LENGTH } from '@/lib'
import { deleteTopic, updateTopic } from '@/services'

type TopicSettingsProps = {
  isOpen: boolean
}

export default function TopicSettings({ isOpen }: TopicSettingsProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] =
    useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const { topic, setAllTopics } = useTopic()

  const [_, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (isOpen && topic?.title) {
      setTitle(topic.title)
    }
  }, [isOpen, topic?.title])

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (error) setError('')
  }

  const handleSave = async (e: FormEvent): Promise<void> => {
    if (!topic) return
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
      setAllTopics(prev => prev.map(t => (t.id === topic.id ? topic : t)))
      toast.success('Title updated!', {
        iconTheme: {
          primary: 'green',
          secondary: 'white'
        }
      })
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
    return !title || title === topic?.title
  }

  const handleDeleteTopic = async (): Promise<void> => {
    if (!topic) return
    try {
      await deleteTopic(topic.id)
      setAllTopics(prev => prev.filter(t => t.id !== topic.id))
      setSearchParams({})
    } catch (error) {
      console.error('Failed to delete topic.', error)
    }
  }

  return (
    <Screen isOpen={isOpen} onClose={handleClose}>
      {isOpen && <Toaster position="top-center" reverseOrder={false} />}
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
                  className="w-full p-4 rounded-xl border border-gray-300 focus:border-purple-600 focus:outline-none transition"
                />

                <button
                  type="submit"
                  disabled={isDisabled()}
                  className="p-4 rounded-xl flex justify-center items-center bg-purple-600 disabled:opacity-50"
                >
                  <Pencil className="text-white" strokeWidth={3} />
                </button>
              </div>
              {error && <span className="text-red-600 text-sm">{error}</span>}
            </div>
          </form>

          <button
            className="border border-gray-300 p-4 rounded-xl flex gap-2 justify-center items-center"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Download />
            <span>Import cards</span>
          </button>

          <button
            className="border border-gray-300 p-4 rounded-xl flex gap-2 justify-center items-center"
            onClick={() => setIsExportModalOpen(true)}
          >
            <ArrowUpFromLine />
            <span>Export topic</span>
          </button>
        </div>

        <div className="absolute bottom-0 w-full p-4 flex justify-center items-center">
          <button
            onClick={() => setIsConfirmDeleteModalOpen(true)}
            className="flex flex-col justify-center items-center gap-2 text-red-500"
          >
            <span>
              <Trash />
            </span>
            <span className="text-xs">Delete</span>
          </button>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteModalOpen}
        onConfirm={handleDeleteTopic}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        count={1}
        itemName="topic"
      />

      <AnimatePresence>
        {isImportModalOpen && (
          <ImportCardsModal onClose={() => setIsImportModalOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExportModalOpen && (
          <ExportTopicModal onClose={() => setIsExportModalOpen(false)} />
        )}
      </AnimatePresence>
    </Screen>
  )
}
