import { motion } from 'motion/react'
import type { ChangeEvent } from 'react'
import { useState } from 'react'

import { Spinner } from '@/components'
import type { AnkiImportProgress } from '@/services'
import { importAnkiApkg, importCards } from '@/services'

type ImportCardsModal = {
  topicId: string
  onClose: () => void
  onCardsImport: () => Promise<void>
}

function isAnkiApkg(file: File): boolean {
  return file.name.toLowerCase().endsWith('.apkg')
}

function progressLabel(progress: AnkiImportProgress): string {
  if (progress.phase === 'parsing') return 'Parsing…'
  return `Saving ${progress.done}/${progress.total}…`
}

export default function ImportCardsModal({
  topicId,
  onClose,
  onCardsImport
}: ImportCardsModal) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<AnkiImportProgress | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setMessage(null)
    setProgress(null)

    try {
      const anki = isAnkiApkg(file)
      const count = anki
        ? await importAnkiApkg(file, topicId, setProgress)
        : await importCards(file, topicId)
      await onCardsImport()
      setMessage(
        anki
          ? `${count} cards imported to Draft`
          : `${count} cards imported successfully`
      )
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message ?? 'Import failed')
      }
    } finally {
      setIsLoading(false)
      setProgress(null)
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
        <h2 className="text-xl font-bold text-center">Import Cards</h2>

        {!isLoading && !message && !error && (
          <label className="bg-primary text-primary-foreground w-full text-center py-4 rounded-xl cursor-pointer">
            Choose JSON or Anki (.apkg)
            <input
              type="file"
              accept=".json,.apkg,application/json,application/zip"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            {progress && (
              <p className="text-foreground-muted text-center text-sm">
                {progressLabel(progress)}
              </p>
            )}
          </div>
        )}

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
