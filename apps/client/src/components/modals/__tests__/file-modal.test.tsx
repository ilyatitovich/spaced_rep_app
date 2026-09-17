import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

describe('FileModal drop import', () => {
  it('imports a dropped file', async () => {
    vi.mocked(importAppData).mockResolvedValue({ topics: 1, cards: 2 })
    render(<FileModal kind="import-app" isOpen onClose={() => {}} />)

    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    fireEvent.drop(screen.getByRole('region', { name: 'Drop a file to import' }), {
      dataTransfer: { files: [file] }
    })

    await waitFor(() => {
      expect(importAppData).toHaveBeenCalledWith(file)
    })
    expect(
      await screen.findByText('Imported 1 topics and 2 cards')
    ).toBeInTheDocument()
  })
})
