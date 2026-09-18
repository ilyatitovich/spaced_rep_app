import { useRef } from 'react'
import { Share } from 'lucide-react'

import Modal from './modal'
import { usePwaInstall, usePwaUpdate } from '@/hooks'
import { isOnboardingComplete } from '@/lib'
import Button from '../ui/button'

type Kind =
  | 'update'
  | 'chromium-install'
  | 'ios-safari-a2hs'
  | 'ios-open-safari'
  | 'soft-banner'

const TITLES: Partial<Record<Kind, string>> = {
  'chromium-install': 'Install the app',
  'ios-safari-a2hs': 'Add to Home Screen',
  'ios-open-safari': 'Add to Home Screen'
}

export default function PwaModal() {
  const { variant, promptInstall, dismiss, dismissBanner } = usePwaInstall()
  const {
    showPrompt: isUpdateOpen,
    updateNow,
    dismiss: dismissUpdate
  } = usePwaUpdate()

  const installKind =
    isOnboardingComplete() && variant !== 'hidden' ? variant : null
  const kind: Kind | null = isUpdateOpen ? 'update' : installKind
  const isOpen = kind !== null
  const shownRef = useRef<Kind>('update')
  if (kind) shownRef.current = kind
  const shown = shownRef.current

  function handleClose() {
    if (kind === 'update') dismissUpdate()
    else if (kind === 'soft-banner') dismissBanner()
    else if (kind) dismiss()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={TITLES[shown]}>
      {shown === 'update' && (
        <>
          <p className="mb-4 text-sm text-foreground">
            A new version is available. Update now to get the latest
            improvements.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={handleClose}>
              Later
            </Button>
            <Button variant="primary" className="flex-1" onClick={updateNow}>
              Update
            </Button>
          </div>
        </>
      )}

      {shown === 'chromium-install' && (
        <>
          <p className="mb-6 text-center text-foreground-muted">
            It&apos;s better to install for the best experience.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={handleClose}>
              Maybe later
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={promptInstall}
            >
              Install
            </Button>
          </div>
        </>
      )}

      {shown === 'ios-safari-a2hs' && (
        <>
          <p className="mb-4 text-center text-foreground-muted">
            Install this app for the best experience — including push
            notifications on iPhone and iPad.
          </p>
          <ol className="mb-6 space-y-3 text-sm text-foreground">
            <li>
              1. Tap the Share icon <Share /> in the browser toolbar.
            </li>
            <li>
              2. Scroll and choose{' '}
              <span className="font-medium">Add to Home Screen</span>.
            </li>
            <li>
              3. Tap <span className="font-medium">Add</span>, then open the
              app from your Home Screen.
            </li>
          </ol>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleClose}
          >
            Got it
          </Button>
        </>
      )}

      {shown === 'ios-open-safari' && (
        <>
          <p className="mb-6 text-center text-foreground-muted">
            Use Share → Add to Home Screen in this browser, then open the app
            from the icon to enable install features and push.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleClose}
          >
            Got it
          </Button>
        </>
      )}

      {shown === 'soft-banner' && (
        <>
          <p className="mb-6 text-sm text-foreground">
            You might already have this installed — open it from your home
            screen for the best experience.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleClose}
          >
            Got it
          </Button>
        </>
      )}
    </Modal>
  )
}
