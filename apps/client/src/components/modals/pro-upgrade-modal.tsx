import Modal from './modal'

interface ProUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade: () => void
}

export default function ProUpgradeModal({
  isOpen,
  onClose,
  onUpgrade
}: ProUpgradeModalProps) {
  const handleUpgrade = () => {
    onUpgrade()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade to Pro">
      <p className="text-foreground-muted text-center mb-6">
        Cloud sync requires Pro. Upgrade in the app, or skip to keep using the
        app locally.
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
