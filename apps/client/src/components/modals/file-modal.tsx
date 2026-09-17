import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from 'react'

import Modal from './modal'
import Spinner from '../ui/spinner'
import { isAnkiApkg } from '@/lib'
import {
  exportAppData,
  exportTopic,
  importAnkiApkg,
  importAppData,
  importCards
} from '@/services'
import { useTopicsStore } from '@/store'

type FileModalProps = {
  isOpen: boolean
  onClose: () => void
} & (
  | { kind: 'export-app' }
  | { kind: 'export-topic'; topicId: string }
  | { kind: 'import-app' }
  | {
      kind: 'import-cards'
      topicId: string
      onCardsImport: () => Promise<void>
    }
)

const TITLES = {
  'export-app': 'Export All Data',
  'export-topic': 'Export Topic',
  'import-app': 'Import All Data',
  'import-cards': 'Import Cards'
} as const

export default function FileModal(props: FileModalProps) {
  const { isOpen, onClose, kind } = props
  const topicId = 'topicId' in props ? props.topicId : undefined
  const loadTopics = useTopicsStore(state => state.loadTopics)
  const [isLoading, setIsLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return

    setError(null)
    setMessage(null)
    setProgress(null)
    setDownloadUrl(null)
    setFileName('')
    setPastedText('')
    setIsDragging(false)

    if (kind !== 'export-app' && kind !== 'export-topic') {
      setIsLoading(false)
      return
    }

    let urlToRevoke: string | null = null
    let isCancelled = false
    setIsLoading(true)

    const run =
      kind === 'export-app' ? exportAppData() : exportTopic(topicId ?? '')

    run
      .then(({ fileUrl, fileName }) => {
        if (isCancelled) {
          URL.revokeObjectURL(fileUrl)
          return
        }
        urlToRevoke = fileUrl
        setDownloadUrl(fileUrl)
        setFileName(fileName)
      })
      .catch(() => {
        if (isCancelled) return
        setError(
          kind === 'export-app'
            ? 'Failed to export data'
            : 'Failed to export topic'
        )
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke)
    }
  }, [isOpen, kind, topicId])

  const runImport = async (source: File | string) => {
    setIsLoading(true)
    setError(null)
    setMessage(null)
    setProgress(null)

    try {
      if (kind === 'import-app') {
        const { topics, cards } = await importAppData(source)
        await loadTopics()
        setMessage(`Imported ${topics} topics and ${cards} cards`)
        return
      }

      if (kind !== 'import-cards') return

      const anki = source instanceof File && isAnkiApkg(source)
      const count = anki
        ? await importAnkiApkg(source, props.topicId, current => {
            setProgress(
              current.phase === 'parsing'
                ? 'Parsing…'
                : `Saving ${current.done}/${current.total}…`
            )
          })
        : await importCards(source, props.topicId)
      await props.onCardsImport()
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

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void runImport(file)
  }

  const handlePasteImport = () => {
    if (!pastedText.trim()) return
    void runImport(pastedText)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget
    if (next instanceof Node && e.currentTarget.contains(next)) return
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    void runImport(file)
  }

  const isImport = kind === 'import-app' || kind === 'import-cards'

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="center">
      <h2 className="text-xl font-bold text-center">{TITLES[kind]}</h2>

      {isLoading && (
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          {progress && (
            <p className="text-foreground-muted text-center text-sm">
              {progress}
            </p>
          )}
        </div>
      )}

      {!isLoading && error && (
        <p className="text-danger text-center">{error}</p>
      )}

      {!isLoading && message && (
        <p className="text-success text-center">{message}</p>
      )}

      {!isLoading && downloadUrl && (
        <a
          href={downloadUrl}
          download={fileName}
          className="bg-primary text-primary-foreground w-full inline-block text-center py-4 rounded-xl"
        >
          Download JSON
        </a>
      )}

      {isImport && !isLoading && !message && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="region"
          aria-label="Drop a file to import"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col gap-4 rounded-xl ${
            isDragging ? 'ring-2 ring-primary' : ''
          }`}
        >
          <button
            type="button"
            className="bg-primary text-primary-foreground w-full text-center py-4 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
          >
            {kind === 'import-app'
              ? 'Drop or choose JSON'
              : 'Drop or choose JSON or Anki (.apkg)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={kind === 'import-app' ? 'application/json' : '*/*'}
            className="hidden"
            onChange={handleFileSelect}
          />
          <textarea
            aria-label="Paste JSON"
            placeholder="Or paste JSON"
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            className="w-full min-h-32 p-4 rounded-xl border border-border focus:border-input-focus focus:outline-none transition resize-y text-sm font-mono"
          />
          <button
            type="button"
            disabled={!pastedText.trim()}
            onClick={handlePasteImport}
            className="bg-secondary text-foreground w-full py-4 rounded-xl disabled:opacity-50"
          >
            Import pasted JSON
          </button>
        </div>
      )}

      <button className="text-foreground-muted w-full" onClick={onClose}>
        Close
      </button>
    </Modal>
  )
}
