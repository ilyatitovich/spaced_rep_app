import { Monitor, Smartphone, Tablet } from 'lucide-react'

import type { SyncDeviceSummary } from '@/lib/api'
import { describeSyncDevice, formatLastSeen } from '@/lib'

interface SyncedDeviceProps {
  device: SyncDeviceSummary
  isCurrent: boolean
  onDisconnect: () => void
  disabled?: boolean
}

const FORM_FACTOR_ICON = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor
} as const

export function SyncedDevice({
  device,
  isCurrent,
  onDisconnect,
  disabled = false
}: SyncedDeviceProps) {
  const { formFactor, label } = describeSyncDevice(
    device.userAgent,
    device.name
  )
  const Icon = FORM_FACTOR_ICON[formFactor]

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon
        size={18}
        className="shrink-0 text-foreground-muted mt-0.5 self-start"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{label}</p>
        <p className="text-xs text-foreground-muted mt-0.5">
          {isCurrent
            ? 'This device'
            : `Last used ${formatLastSeen(device.lastSeenAt)}`}
        </p>
      </div>
      {!isCurrent && (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={disabled}
          className="text-danger text-sm font-medium shrink-0 disabled:opacity-50"
        >
          Disconnect
        </button>
      )}
    </div>
  )
}
