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

import { BackButton, FileModal, Header, Screen, Button } from '@/components'
import { useAuth, useSync } from '@/contexts'
import {
  clearMediaCache,
  describeSyncDevice,
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
import Modal from '../modals/modal'
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
    reconnectRevokedDevice,
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
  const [pendingDisconnect, setPendingDisconnect] =
    useState<SyncDeviceSummary | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

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
    if (!isOpen) {
      setDevices([])
      setPendingDisconnect(null)
    }
  }, [isOpen, user, loadDevices])

  const closeDisconnectModal = () => {
    if (isDisconnecting) return
    setPendingDisconnect(null)
  }

  const handleConfirmDisconnect = async () => {
    if (!deviceId || !pendingDisconnect) return
    const targetId = pendingDisconnect.id
    const session = await ensureFreshSession()
    if (!session) return
    setIsDisconnecting(true)
    try {
      const result = await revokeSyncDevice(session.accessToken, {
        deviceId: targetId,
        currentDeviceId: deviceId
      })
      if (result.revoked) {
        setDevices(prev => prev.filter(d => d.id !== targetId))
        toast.success('Device disconnected')
        setPendingDisconnect(null)
      }
    } catch {
      toast.error('Could not disconnect device')
    } finally {
      setIsDisconnecting(false)
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
    : status === 'revoked'
      ? 'Disconnected from sync'
      : status === 'syncing'
        ? 'Syncing…'
        : status === 'error'
          ? 'Sync error'
          : status === 'paused'
            ? 'Sync paused'
            : 'Up to date'

  const sortedDevices = [...devices].sort((a, b) => {
    if (a.id === deviceId) return -1
    if (b.id === deviceId) return 1
    return 0
  })

  const handleReconnect = async () => {
    await reconnectRevokedDevice()
    void loadDevices().catch(() => {})
  }

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
          <SettingsGroup
            label="Sync"
            footer={
              status === 'revoked'
                ? 'This browser was disconnected. Reconnect joins again as a new device and uses a sync slot.'
                : undefined
            }
          >
            <div className="flex items-center justify-between px-4 py-3.5 gap-3">
              <span className="flex items-center gap-2 text-foreground">
                {isOnline ? <Cloud size={18} /> : <CloudOff size={18} />}
                {statusLabel}
              </span>
              {status === 'revoked' ? (
                <Button
                  variant="link"
                  className="gap-1"
                  onClick={() => void handleReconnect()}
                  disabled={!isOnline}
                >
                  <RefreshCw size={16} />
                  Reconnect
                </Button>
              ) : (
                <Button
                  variant="link"
                  className="gap-1"
                  onClick={syncNow}
                  disabled={!isOnline || status === 'syncing' || status === 'paused'}
                >
                  <RefreshCw
                    size={16}
                    className={status === 'syncing' ? 'animate-spin' : ''}
                  />
                  Sync now
                </Button>
              )}
            </div>
            <SettingsInfoRow
              label="Last synced"
              value={formatSyncTime(lastSyncedAt)}
            />

            <Button
              variant="unstyled"
              onClick={() => setAdvancedOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground-muted"
            >
              <span>Advanced</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </Button>

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
                {lastError && status !== 'revoked' && (
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
                  onDisconnect={() => setPendingDisconnect(device)}
                  disabled={isDisconnecting}
                />
              ))
            )}
          </SettingsGroup>
        )}
      </div>

      <Modal
        isOpen={pendingDisconnect != null}
        onClose={closeDisconnectModal}
        title="Disconnect device?"
      >
        <p className="text-foreground-muted text-center mb-6">
          <span className="font-medium text-foreground">
            {pendingDisconnect
              ? describeSyncDevice(
                  pendingDisconnect.userAgent,
                  pendingDisconnect.name
                ).label
              : 'This device'}
          </span>{' '}
          will lose its sync slot and cannot reconnect until site data is
          cleared in that browser.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={closeDisconnectModal}
            disabled={isDisconnecting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => void handleConfirmDisconnect()}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      </Modal>

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
