import { useRef } from 'react'
import { Share } from 'lucide-react'

import Modal from './modal'
import { usePwaInstall, usePwaUpdate } from '@/hooks'
import { isOnboardingComplete } from '@/lib'

type Kind =
  | 'update'
  | 'chromium-install'
  | 'ios-safari-a2hs'
  | 'ios-open-safari'
  | 'soft-banner'

const btnSecondary =
  'flex-1 rounded-xl bg-secondary text-foreground py-3 active:scale-95'
const btnPrimary =
  'flex-1 rounded-xl bg-primary py-3 font-medium text-primary-foreground active:scale-95'

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
    <Modal isOpen={isOpen} onClose={handleClose}>
      {shown === 'update' && (
        <>
          <p className="mb-4 text-sm text-foreground">
            A new version is available. Update now to get the latest
            improvements.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className={btnSecondary}
            >
              Later
            </button>
            <button type="button" onClick={updateNow} className={btnPrimary}>
              Update
            </button>
          </div>
        </>
      )}

      {shown === 'chromium-install' && (
        <>
          <h2 className="mb-2 text-center text-xl font-semibold">
            Install the app
          </h2>
          <p className="mb-6 text-center text-foreground-muted">
            It&apos;s better to install for the best experience.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className={btnSecondary}
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={promptInstall}
              className={btnPrimary}
            >
              Install
            </button>
          </div>
        </>
      )}

      {shown === 'ios-safari-a2hs' && (
        <>
          <h2 className="mb-2 text-center text-xl font-semibold">
            Add to Home Screen
          </h2>
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
          <button type="button" onClick={handleClose} className={btnSecondary}>
            Got it
          </button>
        </>
      )}

      {shown === 'ios-open-safari' && (
        <>
          <h2 className="mb-2 text-center text-xl font-semibold">
            Add to Home Screen
          </h2>
          <p className="mb-6 text-center text-foreground-muted">
            Use Share → Add to Home Screen in this browser, then open the app
            from the icon to enable install features and push.
          </p>
          <button type="button" onClick={handleClose} className={btnSecondary}>
            Got it
          </button>
        </>
      )}

      {shown === 'soft-banner' && (
        <>
          <p className="mb-6 text-sm text-foreground">
            You might already have this installed — open it from your home
            screen for the best experience.
          </p>
          <button type="button" onClick={handleClose} className={btnSecondary}>
            Got it
          </button>
        </>
      )}
    </Modal>
  )
}
