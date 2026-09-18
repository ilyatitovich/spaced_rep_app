import {
  ArrowUpFromLine,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  RefreshCw
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'

import { BackButton, FileModal, Header, Screen } from '@/components'
import { useAuth, useSync } from '@/contexts'
import {
  clearMediaCache,
  formatBytes,
  formatSyncTime,
  getStorageUsage,
  type StorageUsage
} from '@/lib'
import {
  ensureFreshSession,
  fetchSyncDevices,
  revokeSyncDevice,
  type SyncDeviceSummary
} from '@/lib/api'
import { PRO_DEVICE_LIMIT } from '@/lib/billing-product'
import { getSyncDiagnostics } from '@/services'
import { SyncedDevice } from './synced-device'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsInfoRow
} from './settings-ui'

type SectionDataProps = {
  isOpen: boolean
}

function formatUsedValue(stats: StorageUsage | null): ReactNode {
  if (!stats) return '…'
  if (!stats.estimateAvailable) return 'Unavailable'
  const label = `${formatBytes(stats.usage)} of ${formatBytes(stats.quota)}`
  const ratio = stats.quota > 0 ? stats.usage / stats.quota : 0
  const className =
    ratio >= 0.9 ? 'text-danger' : ratio >= 0.8 ? 'text-warning' : undefined
  return className ? <span className={className}>{label}</span> : label
}

function formatTopicsCards(stats: StorageUsage | null): string {
  if (!stats) return '…'
  const topics = `${stats.topicCount} topic${stats.topicCount === 1 ? '' : 's'}`
  const cards = `${stats.cardCount.toLocaleString()} card${stats.cardCount === 1 ? '' : 's'}`
  return `${topics} · ${cards}`
}

function formatCachedImages(stats: StorageUsage | null): string {
  if (!stats) return '…'
  const images = `${stats.cacheCount.toLocaleString()} image${stats.cacheCount === 1 ? '' : 's'}`
  return `${formatBytes(stats.cacheBytes)} · ${images}`
}

function formatCardMedia(stats: StorageUsage | null): string {
  if (!stats) return '…'
  const images = `${stats.cardImageCount.toLocaleString()} image${stats.cardImageCount === 1 ? '' : 's'}`
  const audio = `${stats.cardAudioCount.toLocaleString()} audio`
  return `${formatBytes(stats.cardMediaBytes)} · ${images} · ${audio}`
}

export default function SectionData({ isOpen }: SectionDataProps) {
  const { user } = useAuth()
  const {
    status,
    lastSyncedAt,
    isOnline,
    syncNow,
    connection,
    queueDepth,
    deviceId,
    lastError,
    failedOps
  } = useSync()
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [diagnostics, setDiagnostics] = useState<{
    lastPulledAt: string
    wsState: string
  } | null>(null)
  const [storage, setStorage] = useState<StorageUsage | null>(null)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const [devices, setDevices] = useState<SyncDeviceSummary[]>([])
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const refreshStorage = useCallback(() => {
    void getStorageUsage().then(setStorage)
  }, [])

  const loadDevices = useCallback(async () => {
    const session = await ensureFreshSession()
    if (!session) return
    const result = await fetchSyncDevices(session.accessToken)
    setDevices(result.devices)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    refreshStorage()
  }, [isOpen, refreshStorage])

  useEffect(() => {
    if (!isOpen || !user) return
    void getSyncDiagnostics().then(d =>
      setDiagnostics({ lastPulledAt: d.lastPulledAt, wsState: d.wsState })
    )
  }, [isOpen, user, status, lastSyncedAt])

  useEffect(() => {
    if (isOpen && user) {
      void loadDevices().catch(() => toast.error('Could not load devices'))
    }
    if (!isOpen) setDevices([])
  }, [isOpen, user, loadDevices])

  const handleDisconnect = async (targetId: string) => {
    if (!deviceId) return
    const ok = window.confirm(
      'Disconnect this device from sync? It will lose its sync slot and cannot reconnect until site data is cleared in that browser.'
    )
    if (!ok) return

    const session = await ensureFreshSession()
    if (!session) return
    setRevokingId(targetId)
    try {
      const result = await revokeSyncDevice(session.accessToken, {
        deviceId: targetId,
        currentDeviceId: deviceId
      })
      if (result.revoked) {
        setDevices(prev => prev.filter(d => d.id !== targetId))
        toast.success('Device disconnected')
      }
    } catch {
      toast.error('Could not disconnect device')
    } finally {
      setRevokingId(null)
    }
  }

  const handleClearCache = async () => {
    if (!storage || storage.cacheCount === 0) return
    const ok = window.confirm(
      'Clear cached images? Remote images will download again when you review cards online. Card media from Anki packs is not deleted.'
    )
    if (!ok) return
    setIsClearingCache(true)
    try {
      await clearMediaCache()
      refreshStorage()
    } finally {
      setIsClearingCache(false)
    }
  }

  const statusLabel = !isOnline
    ? 'Offline'
    : status === 'syncing'
      ? 'Syncing…'
      : status === 'error'
        ? 'Sync error'
        : 'Up to date'

  const sortedDevices = [...devices].sort((a, b) => {
    if (a.id === deviceId) return -1
    if (b.id === deviceId) return 1
    return 0
  })

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Data & Sync</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        <SettingsGroup
          label="Storage"
          footer="Approximate. Card media is images and audio stored on cards. Cached images download again when you review online."
        >
          <SettingsInfoRow label="Used" value={formatUsedValue(storage)} />
          <SettingsInfoRow
            label="Topics & cards"
            value={formatTopicsCards(storage)}
          />
          <SettingsInfoRow
            label="Card media"
            value={formatCardMedia(storage)}
          />
          <SettingsInfoRow
            label="Cached images"
            value={formatCachedImages(storage)}
          />
          <SettingsActionRow
            label="Clear cached images"
            onClick={() => void handleClearCache()}
            disabled={!storage || storage.cacheCount === 0 || isClearingCache}
            destructive
          />
        </SettingsGroup>

        <SettingsGroup label="Backup">
          <SettingsActionRow
            icon={<Download size={18} />}
            label="Import all data"
            onClick={() => setIsImportModalOpen(true)}
          />
          <SettingsActionRow
            icon={<ArrowUpFromLine size={18} />}
            label="Export all data"
            onClick={() => setIsExportModalOpen(true)}
          />
        </SettingsGroup>

        {user && (
          <SettingsGroup label="Sync">
            <div className="flex items-center justify-between px-4 py-3.5 gap-3">
              <span className="flex items-center gap-2 text-foreground">
                {isOnline ? <Cloud size={18} /> : <CloudOff size={18} />}
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={syncNow}
                disabled={!isOnline || status === 'syncing'}
                className="flex items-center gap-1 text-primary disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={status === 'syncing' ? 'animate-spin' : ''}
                />
                Sync now
              </button>
            </div>
            <SettingsInfoRow
              label="Last synced"
              value={formatSyncTime(lastSyncedAt)}
            />

            <button
              type="button"
              onClick={() => setAdvancedOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground-muted"
            >
              <span>Advanced</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {advancedOpen && (
              <div className="px-4 py-3 text-xs text-foreground-subtle flex flex-col gap-1">
                <span>
                  Connection: {connection}
                  {diagnostics ? ` · WS ${diagnostics.wsState}` : ''}
                </span>
                <span>Queue: {queueDepth} pending</span>
                {deviceId && (
                  <span className="truncate">Device: {deviceId}</span>
                )}
                {diagnostics && (
                  <span className="truncate">
                    Watermark: {diagnostics.lastPulledAt}
                  </span>
                )}
                {lastError && (
                  <span className="text-danger">
                    Something went wrong. Try again, or contact us if it keeps
                    happening.
                  </span>
                )}
                {failedOps.length > 0 && (
                  <span className="text-warning">
                    {failedOps.length} failed op
                    {failedOps.length === 1 ? '' : 's'} (dead-letter)
                  </span>
                )}
              </div>
            )}
          </SettingsGroup>
        )}

        {user && (
          <SettingsGroup
            label={
              devices.length > 0
                ? `Devices · ${devices.length} of ${PRO_DEVICE_LIMIT}`
                : 'Devices'
            }
            footer={`Pro supports up to ${PRO_DEVICE_LIMIT} active devices. Inactive devices age out after 30 days.`}
          >
            {sortedDevices.length === 0 ? (
              <p className="px-4 py-3.5 text-sm text-foreground-muted">
                Devices appear after the first sync.
              </p>
            ) : (
              sortedDevices.map(device => (
                <SyncedDevice
                  key={device.id}
                  device={device}
                  isCurrent={device.id === deviceId}
                  onDisconnect={() => void handleDisconnect(device.id)}
                  disabled={revokingId === device.id}
                />
              ))
            )}
          </SettingsGroup>
        )}
      </div>

      <FileModal
        kind="import-app"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
      <FileModal
        kind="export-app"
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </Screen>
  )
}
