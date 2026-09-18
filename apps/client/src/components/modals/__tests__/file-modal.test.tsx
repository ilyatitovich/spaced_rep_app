import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FileModal from '../file-modal'
import { importAppData } from '@/services'

vi.mock('@/services', () => ({
  exportAppData: vi.fn(),
  exportTopic: vi.fn(),
  importAnkiApkg: vi.fn(),
  importAppData: vi.fn(),
  importCards: vi.fn()
}))

vi.mock('@/store', () => ({
  useTopicsStore: (select: (s: { loadTopics: () => Promise<void> }) => unknown) =>
    select({ loadTopics: vi.fn(async () => {}) })
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function dropBackup() {
  const file = new File(['{}'], 'backup.json', { type: 'application/json' })
  fireEvent.drop(screen.getByRole('region', { name: 'Drop a file to import' }), {
    dataTransfer: { files: [file] }
  })
  return file
}

describe('FileModal drop import', () => {
  it('imports a dropped file', async () => {
    vi.mocked(importAppData).mockResolvedValue({ topics: 1, cards: 2 })
    render(<FileModal kind="import-app" isOpen onClose={() => {}} />)

    const file = dropBackup()

    await waitFor(() => {
      expect(importAppData).toHaveBeenCalledWith(file)
    })
    expect(
      await screen.findByText('Imported 1 topics and 2 cards')
    ).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('toasts when import finishes after the modal was closed', async () => {
    let resolveImport!: (value: { topics: number; cards: number }) => void
    vi.mocked(importAppData).mockReturnValue(
      new Promise(resolve => {
        resolveImport = resolve
      })
    )

    const { rerender } = render(
      <FileModal kind="import-app" isOpen onClose={() => {}} />
    )
    dropBackup()
    rerender(<FileModal kind="import-app" isOpen={false} onClose={() => {}} />)
    resolveImport({ topics: 1, cards: 2 })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Imported 1 topics and 2 cards'
      )
    })
    expect(
      screen.queryByText('Imported 1 topics and 2 cards')
    ).not.toBeInTheDocument()
  })
})
