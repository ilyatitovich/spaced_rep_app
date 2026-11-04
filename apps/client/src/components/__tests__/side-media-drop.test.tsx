import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Side from '@/components/side'
import type { SideBlock } from '@/types'

vi.mock('@/lib/image', () => ({
  processImage: async () =>
    new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }),
  blobToRecord: async () => ({
    buffer: new Uint8Array([1, 2, 3, 4]).buffer,
    type: 'image/webp'
  })
}))

vi.mock('@/components/content/text-block/text-block-editor', () => ({
  default: () => <div data-testid="text-editor" />
}))

vi.mock('@/components/content/text-block/text-format-toolbar', () => ({
  default: () => null,
  isToolbarTarget: () => false
}))

vi.mock('@/components/content/image-block/image-block', () => ({
  default: () => <div data-testid="image-block" />
}))

vi.mock('@/components/content/audio-block/audio-block', () => ({
  default: () => <div data-testid="audio-block" />
}))

vi.mock('react-hot-toast', () => {
  const toast = { success: vi.fn(), error: vi.fn() }
  return { default: toast, toast }
})

beforeEach(() => {
  vi.clearAllMocks()
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO)
})

function file(name: string, type: string, sizeBytes: number): File {
  const bytes = new Uint8Array(sizeBytes)
  const f = new File([bytes], name, { type })
  if (typeof f.arrayBuffer !== 'function') {
    Object.defineProperty(f, 'arrayBuffer', {
      value: async () => bytes.buffer.slice(0, sizeBytes)
    })
  }
  return f
}

function Harness({
  editable = true,
  onChange
}: {
  editable?: boolean
  onChange?: (blocks: SideBlock[]) => void
}) {
  const [blocks, setBlocks] = useState<SideBlock[]>([
    { type: 'text', html: '' }
  ])
  return (
    <Side
      data={{ side: 'front', blocks }}
      isEditable={editable}
      onChange={next => {
        setBlocks(next)
        onChange?.(next)
      }}
    />
  )
}

function dropOnCard(files: File[]) {
  fireEvent.drop(screen.getByRole('region', { name: 'Drop image or audio' }), {
    dataTransfer: { files }
  })
}

describe('Side media drop', () => {
  it('appends an image block when a PNG is dropped', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    dropOnCard([file('shot.png', 'image/png', 32)])

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    const blocks = onChange.mock.calls.at(-1)?.[0] as SideBlock[]
    expect(blocks.some(b => b.type === 'image')).toBe(true)
  })

  it('appends an audio block when an MP3 is dropped', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    dropOnCard([file('clip.mp3', 'audio/mpeg', 32)])

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    const blocks = onChange.mock.calls.at(-1)?.[0] as SideBlock[]
    expect(blocks.some(b => b.type === 'audio')).toBe(true)
  })

  it('toasts and leaves blocks unchanged for SVG', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    dropOnCard([file('evil.svg', 'image/svg+xml', 32)])

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('toasts for oversized files', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    dropOnCard([file('big.png', 'image/png', 5 * 1024 * 1024 + 1)])

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('toasts for non-media files', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    dropOnCard([file('payload.exe', 'application/octet-stream', 32)])

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not expose a drop region when not editable', () => {
    render(<Harness editable={false} />)
    expect(
      screen.queryByRole('region', { name: 'Drop image or audio' })
    ).not.toBeInTheDocument()
  })
})
