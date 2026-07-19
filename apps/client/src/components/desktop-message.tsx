import QrCode from './qrcode'
import { APP_URL, openNarrowWindow } from '@/lib'

export default function DesktopMessage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-2xl">
          📱
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            This app is for mobile
          </h1>
          <p className="text-sm text-foreground-muted">
            Scan the QR code with your phone, or resize this window to continue.
          </p>
        </div>

        <QrCode url={APP_URL} />

        <div className="flex w-full items-center gap-3 text-xs text-foreground-subtle">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={openNarrowWindow}
          className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground-muted active:bg-primary"
        >
          Open in narrow window
        </button>
      </div>
    </div>
  )
}
