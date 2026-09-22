import { Download, LogIn, LogOut, RefreshCw } from 'lucide-react'

type PanelFooterProps = {
  signedIn: boolean
  isPro: boolean
  busy: boolean
  savedCount: number
  onSignIn: () => void
  onSignOut: () => void
  onExport: () => void
  onSync: () => void
}

export default function PanelFooter({
  signedIn,
  isPro,
  busy,
  savedCount,
  onSignIn,
  onSignOut,
  onExport,
  onSync
}: PanelFooterProps) {
  return (
    <footer className="p-3 border-t border-border flex gap-2">
      {signedIn ? (
        <button
          className="flex-1 border border-border rounded-lg py-2 text-sm flex justify-center gap-2"
          onClick={onSignOut}
        >
          <LogOut size={17} /> Sign out
        </button>
      ) : (
        <button
          className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm flex justify-center gap-2"
          disabled={busy}
          onClick={onSignIn}
        >
          <LogIn size={17} /> Sign in to sync
        </button>
      )}
      <button
        className="flex-1 border border-border rounded-lg py-2 text-sm flex justify-center gap-2 disabled:opacity-40"
        disabled={!savedCount}
        onClick={onExport}
      >
        <Download size={17} /> Export
      </button>
      {isPro && (
        <button
          title="Sync now"
          className="border border-border rounded-lg p-2"
          onClick={onSync}
        >
          <RefreshCw size={17} />
        </button>
      )}
    </footer>
  )
}
