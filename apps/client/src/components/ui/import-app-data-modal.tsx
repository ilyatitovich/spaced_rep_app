import { motion } from 'motion/react'
import type { ChangeEvent } from 'react'
import { useState } from 'react'

import { Spinner } from '@/components'
import { importAppData } from '@/services'
import { useTopicsStore } from '@/store'

type ImportAppDataModalProps = {
  onClose: () => void
}

export default function ImportAppDataModal({
  onClose
}: ImportAppDataModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadTopics = useTopicsStore(state => state.loadTopics)

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { topics, cards } = await importAppData(file)
      await loadTopics()
      setMessage(`Imported ${topics} topics and ${cards} cards`)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message ?? 'Import failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        className="fixed inset-0 bg-background-overlay z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="fixed top-1/2 left-4 -translate-y-1/2 right-4 z-50 bg-card rounded-3xl p-6 flex flex-col gap-4"
        initial={{ opacity: 0, y: '20%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '20%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-center">Import All Data</h2>

        {!isLoading && !message && !error && (
          <label className="bg-primary text-primary-foreground w-full text-center py-4 rounded-xl cursor-pointer">
            Choose JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {isLoading && <Spinner />}

        {!isLoading && message && (
          <p className="text-success text-center">{message}</p>
        )}

        {!isLoading && error && (
          <p className="text-danger text-center">{error}</p>
        )}

        <button className="text-foreground-muted w-full" onClick={onClose}>
          Close
        </button>
      </motion.div>
    </>
  )
}
