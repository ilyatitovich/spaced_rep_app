import Modal from './modal'
import Button from '../ui/button'

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
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Skip
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleUpgrade}>
          Upgrade
        </Button>
      </div>
    </Modal>
  )
}
