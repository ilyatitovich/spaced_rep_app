import Modal from '@/components/modals/modal'

const APP_URL = (
  import.meta.env.WXT_PUBLIC_APP_URL ?? 'http://localhost:5173'
).replace(/\/$/, '')

interface ProUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ProUpgradeModal({
  isOpen,
  onClose
}: ProUpgradeModalProps) {
  const handleUpgrade = () => {
    void chrome.tabs.create({
      url: `${APP_URL}/?settings=true&subscription=true`
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-semibold text-center mb-2">
        Upgrade to Pro
      </h2>
      <p className="text-foreground-muted text-center mb-6">
        Cloud sync requires Pro. Upgrade in the app, or skip to keep saving
        cards locally.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-secondary text-foreground active:scale-95"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleUpgrade}
          className="flex-1 py-3 rounded-xl bg-primary font-medium text-primary-foreground active:scale-95"
        >
          Upgrade
        </button>
      </div>
    </Modal>
  )
}
