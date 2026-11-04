import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, useEffect, useRef, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TestScreen from '@/components/screens/topic-test'
import { getToday } from '@/lib'
import { Card, Day, type Topic } from '@/models'
import type { CardData } from '@/types'

const getCardsByTopicAndLevel = vi.fn()
const updateCard = vi.fn()
const updateTopic = vi.fn()

vi.mock('@/services', () => ({
  getCardsByTopicAndLevel: (...args: unknown[]) =>
    getCardsByTopicAndLevel(...args),
  updateCard: (...args: unknown[]) => updateCard(...args),
  updateTopic: (...args: unknown[]) => updateTopic(...args)
}))

// Only the study logic is under test: swap the visual shell for thin stubs.
vi.mock('@/components', () => {
  const passthrough = ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children)

  return {
    Screen: ({
      isOpen,
      onOpen,
      children
    }: {
      isOpen: boolean
      onOpen?: () => void
      children?: ReactNode
    }) => {
      // Like the real Screen: fire once per open, not per callback identity.
      const onOpenRef = useRef(onOpen)
      onOpenRef.current = onOpen
      useEffect(() => {
        if (isOpen) onOpenRef.current?.()
      }, [isOpen])
      return createElement('div', null, children)
    },
    Header: passthrough,
    CardContainer: passthrough,
    BackButton: () => null,
    TestDoneMessage: () => createElement('p', null, 'All done'),
    CardsLeftBadge: ({ current, total }: { current: number; total: number }) =>
      createElement('span', null, `left ${current}/${total}`),
    Card: ({
      data,
      handleClick
    }: {
      data: CardData
      handleClick: () => void
    }) => {
      const block = data.front.blocks[0]
      return createElement(
        'button',
        { type: 'button', onClick: handleClick },
        block?.type === 'text' ? block.html : ''
      )
    },
    AnswerButton: ({
      isCorrect,
      onAnswer
    }: {
      isCorrect: boolean
      onAnswer: (isCorrect: boolean) => void
    }) =>
      createElement(
        'button',
        { type: 'button', onClick: () => onAnswer(isCorrect) },
        isCorrect ? 'Correct' : 'Wrong'
      )
  }
})

function makeCard(text: string): Card {
  return new Card(
    {
      front: { side: 'front', blocks: [{ type: 'text', html: text }] },
      back: { side: 'back', blocks: [{ type: 'text', html: `${text} back` }] }
    },
    'topic-1',
    1
  )
}

function makeTopic(): Topic {
  return {
    id: 'topic-1',
    title: 'Topic',
    pivot: Date.now(),
    week: Array.from({ length: 7 }, () => new Day(Date.now())),
    nextUpdateDate: Date.now() + 86_400_000,
    updatedAt: Date.now(),
    deletedAt: null
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(res => {
    resolve = res
  })
  return { promise, resolve }
}

async function openWithCards(cards: Card[], topic = makeTopic()) {
  getCardsByTopicAndLevel.mockResolvedValue(cards)
  const view = render(<TestScreen isOpen topic={topic} />)
  if (cards.length > 0) {
    await screen.findByText(`left ${cards.length}/${cards.length}`)
  }
  return { ...view, topic }
}

describe('TestScreen grading', () => {
  beforeEach(() => {
    getCardsByTopicAndLevel.mockReset()
    updateCard.mockReset()
    updateTopic.mockReset()
    updateTopic.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('grades one card once when the answer is tapped twice while saving', async () => {
    const gate = deferred()
    updateCard.mockReturnValue(gate.promise)
    await openWithCards([makeCard('first'), makeCard('second')])

    fireEvent.click(screen.getByText('first'))
    const correct = screen.getByRole('button', { name: 'Correct' })
    fireEvent.click(correct)
    fireEvent.click(correct)

    expect(updateCard).toHaveBeenCalledTimes(1)
    await act(async () => gate.resolve())
    await screen.findByText('left 1/2')
  })

  it('keeps the card in the queue when saving the grade fails', async () => {
    updateCard.mockRejectedValueOnce(new Error('write failed'))
    updateCard.mockResolvedValue(undefined)
    await openWithCards([makeCard('first'), makeCard('second')])

    fireEvent.click(screen.getByText('first'))
    fireEvent.click(screen.getByRole('button', { name: 'Correct' }))
    await waitFor(() => expect(updateCard).toHaveBeenCalledTimes(1))
    await act(async () => {})

    expect(screen.getByText('left 2/2')).toBeInTheDocument()

    // Still on the same card, answer still revealed: retry grades it again.
    fireEvent.click(screen.getByRole('button', { name: 'Correct' }))
    await waitFor(() => expect(updateCard).toHaveBeenCalledTimes(2))

    const retried = updateCard.mock.calls[1]![0] as Card
    expect(retried.id).toBe(updateCard.mock.calls[0]![0].id)
  })
})

describe('TestScreen day completion', () => {
  beforeEach(() => {
    getCardsByTopicAndLevel.mockReset()
    updateTopic.mockReset()
    updateTopic.mockResolvedValue(undefined)
  })

  it('persists the finished day once even when the parent refetches the topic', async () => {
    const { rerender, topic } = await openWithCards([])

    await waitFor(() => expect(updateTopic).toHaveBeenCalledTimes(1))
    expect(topic.week[getToday()]!.isDone).toBe(true)

    // The parent refetches after emitStudyData: a fresh topic object, already done.
    rerender(<TestScreen isOpen topic={structuredClone(topic)} />)
    await act(async () => {})

    expect(updateTopic).toHaveBeenCalledTimes(1)
  })
})
