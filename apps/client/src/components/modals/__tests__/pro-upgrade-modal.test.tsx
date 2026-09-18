import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProUpgradeModal from '../pro-upgrade-modal'
import ProUpgradeOnSignIn from '../pro-upgrade-on-sign-in'

const pullRemote = vi.fn()
const hasPlan = vi.fn()
let authUser: { id: string } | null = null

vi.mock('@/contexts', () => ({
  useAuth: () => ({ user: authUser })
}))

vi.mock('@/store', () => ({
  useSettingsStore: {
    getState: () => ({ pullRemote, hasPlan })
  }
}))

function SearchProbe() {
  const [params] = useSearchParams()
  return <div data-testid="qs">{params.toString()}</div>
}

function PromptHost() {
  const [, setTick] = useState(0)
  return (
    <MemoryRouter>
      <button type="button" onClick={() => setTick(n => n + 1)}>
        refresh
      </button>
      <ProUpgradeOnSignIn />
      <SearchProbe />
    </MemoryRouter>
  )
}

function isUpgradeModalOpen() {
  const heading = screen.getByRole('heading', { name: 'Upgrade to Pro' })
  return !heading
    .closest('[data-screen]')
    ?.classList.contains('pointer-events-none')
}

function renderPrompt() {
  return render(<PromptHost />)
}

function signIn(id: string) {
  authUser = { id }
  fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
}

describe('ProUpgradeModal', () => {
  it('skips or upgrades through the public buttons', () => {
    const onClose = vi.fn()
    const onUpgrade = vi.fn()
    render(<ProUpgradeModal isOpen onClose={onClose} onUpgrade={onUpgrade} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onUpgrade).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }))
    expect(onUpgrade).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('ProUpgradeOnSignIn', () => {
  beforeEach(() => {
    authUser = null
    pullRemote.mockReset()
    hasPlan.mockReset()
    pullRemote.mockResolvedValue(undefined)
    hasPlan.mockReturnValue(false)
  })

  it('does not prompt a user who was already signed in', () => {
    authUser = { id: 'user-1' }
    renderPrompt()

    expect(pullRemote).not.toHaveBeenCalled()
    expect(isUpgradeModalOpen()).toBe(false)
  })

  it('prompts after sign-in when the user is not Pro', async () => {
    renderPrompt()
    signIn('user-1')

    await waitFor(() => {
      expect(isUpgradeModalOpen()).toBe(true)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }))
    expect(screen.getByTestId('qs')).toHaveTextContent(
      'settings=true&subscription=true'
    )
  })

  it('does not prompt after sign-in when the user is Pro', async () => {
    hasPlan.mockReturnValue(true)
    renderPrompt()
    signIn('user-1')

    await waitFor(() => {
      expect(pullRemote).toHaveBeenCalledWith('user-1')
    })
    expect(isUpgradeModalOpen()).toBe(false)
  })
})
