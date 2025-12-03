import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

import Spinner from './spinner'
import { exportTopic } from '@/services'

type ExportTopicModalProps = {
  topicId: string
  onClose: () => void
}

export default function ExportTopicModal({
  topicId,
  onClose
}: ExportTopicModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let urlToRevoke: string | null = null
    const handleExport = async () => {
      try {
        const { fileUrl, fileName } = await exportTopic(topicId)
        setDownloadUrl(fileUrl)
        setFileName(fileName)
        urlToRevoke = fileUrl
      } catch (err) {
        setError('Failed to export topic')
      } finally {
        setIsLoading(false)
      }
    }

    handleExport()

    return () => {
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke)
      }
    }
  }, [topicId])

  return (
    <>
      {/* Background overlay */}
      <motion.div
        className="fixed inset-0 bg-black/40 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="fixed top-1/2 left-4 -translate-y-1/2 right-4 z-50 bg-white rounded-3xl p-6 flex flex-col gap-4"
        initial={{ opacity: 0, y: '20%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '20%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h2 className="text-xl font-bold text-center">Export Topic</h2>

        {isLoading && <Spinner />}

        {!isLoading && error && (
          <p className="text-red-500 text-center">{error}</p>
        )}

        {!isLoading && downloadUrl && (
          <a
            href={downloadUrl}
            download={fileName}
            className="bg-purple-600 text-white w-full inline-block text-center py-4 rounded-xl"
          >
            Download JSON
          </a>
        )}

        <button className="text-gray-600" onClick={onClose}>
          Close
        </button>
      </motion.div>
    </>
  )
}
