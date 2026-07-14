import { AnimatePresence, motion } from 'motion/react'

import type { InstallVariant } from '@/hooks'

interface InstallAppSheetProps {
  variant: InstallVariant
  onInstall: () => void
  onDismiss: () => void
  onDismissBanner: () => void
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline-block h-5 w-5 align-text-bottom text-purple-600"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

export default function InstallAppSheet({
  variant,
  onInstall,
  onDismiss,
  onDismissBanner
}: InstallAppSheetProps) {
  if (variant === 'soft-banner') {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-lg"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <p className="flex-1 text-sm text-gray-700">
            You might already have this installed — open it from your home
            screen for the best experience.
          </p>
          <button
            onClick={onDismissBanner}
            className="shrink-0 rounded-xl bg-gray-200 px-4 py-2 text-sm active:scale-95"
          >
            Got it
          </button>
        </motion.div>
      </AnimatePresence>
    )
  }

  const isOpen =
    variant === 'chromium-install' ||
    variant === 'ios-safari-a2hs' ||
    variant === 'ios-open-safari'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />

          <motion.div
            className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl bg-white p-6"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {variant === 'chromium-install' && (
              <>
                <h2 className="mb-2 text-center text-xl font-semibold">
                  Install the app
                </h2>
                <p className="mb-6 text-center text-gray-600">
                  It&apos;s better to install for the best experience.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={onDismiss}
                    className="flex-1 rounded-xl bg-gray-200 py-3 active:scale-95"
                  >
                    Maybe later
                  </button>
                  <button
                    onClick={onInstall}
                    className="flex-1 rounded-xl bg-purple-600 py-3 font-medium text-white active:scale-95"
                  >
                    Install
                  </button>
                </div>
              </>
            )}

            {variant === 'ios-safari-a2hs' && (
              <>
                <h2 className="mb-2 text-center text-xl font-semibold">
                  Add to Home Screen
                </h2>
                <p className="mb-4 text-center text-gray-600">
                  Install this app for the best experience.
                </p>
                <ol className="mb-6 space-y-3 text-sm text-gray-700">
                  <li>
                    1. Tap the Share icon <ShareIcon /> in the Safari toolbar.
                  </li>
                  <li>
                    2. Scroll and choose{' '}
                    <span className="font-medium">Add to Home Screen</span>.
                  </li>
                  <li>
                    3. Tap <span className="font-medium">Add</span> to finish.
                  </li>
                </ol>
                <button
                  onClick={onDismiss}
                  className="w-full rounded-xl bg-gray-200 py-3 active:scale-95"
                >
                  Got it
                </button>
              </>
            )}

            {variant === 'ios-open-safari' && (
              <>
                <h2 className="mb-2 text-center text-xl font-semibold">
                  Open in Safari to install
                </h2>
                <p className="mb-6 text-center text-gray-600">
                  Installing to your home screen is only available in Safari on
                  iOS. Open this page in Safari to add the app.
                </p>
                <button
                  onClick={onDismiss}
                  className="w-full rounded-xl bg-gray-200 py-3 active:scale-95"
                >
                  Maybe later
                </button>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
