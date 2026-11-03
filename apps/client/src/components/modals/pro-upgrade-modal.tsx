import Modal from './modal'
import Button from '@/components/ui/button'

interface ProUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  /** When set, show Skip / Upgrade (e.g. browser extension). Omitted during unpaid web beta. */
  onUpgrade?: () => void
}

export default function ProUpgradeModal({
  isOpen,
  onClose,
  onUpgrade
}: ProUpgradeModalProps) {
  if (!onUpgrade) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Cloud sync needs Pro">
        <p className="text-foreground-muted text-center mb-6">
          Paid checkout is not open during this unpaid beta. Keep studying
          locally, or use a beta Pro grant if you have one.
        </p>
        <Button variant="primary" className="w-full" onClick={onClose}>
          Continue
        </Button>
      </Modal>
    )
  }

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
