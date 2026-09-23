import { afterEach, describe, expect, it, vi } from 'vitest'

import { shareFile } from '../share'

describe('shareFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shares json as text/plain with a safe name', async () => {
    let shared: File | undefined
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: ShareData) => {
        shared = data.files?.[0]
      }
    })

    await shareFile(
      new File(['{}'], 'topic-a/b-2026-09-23T14:29:00.000Z.json', {
        type: 'application/json'
      }),
      'Topic'
    )

    expect(shared?.type).toBe('text/plain')
    expect(shared?.name).toBe('topic-a-b-2026-09-23T14-29-00.000Z.txt')
    expect(shared?.size).toBe(2)
  })

  it('downloads the original file when share is denied', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('Permission denied', 'NotAllowedError')
      }
    })
    const click = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = Document.prototype.createElement.call(document, tag)
      if (tag === 'a') el.click = click
      return el
    })

    const file = new File(['{}'], 'cards.json', { type: 'application/json' })
    await shareFile(file)

    expect(click).toHaveBeenCalledOnce()
  })

  it('does not download when the user cancels the sheet', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('Share canceled', 'AbortError')
      }
    })
    const click = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = Document.prototype.createElement.call(document, tag)
      if (tag === 'a') el.click = click
      return el
    })

    await expect(shareFile(new File(['{}'], 'cards.json'))).rejects.toThrow(
      'Share canceled'
    )
    expect(click).not.toHaveBeenCalled()
  })
})
