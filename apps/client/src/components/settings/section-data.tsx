import {
  ArrowUpFromLine,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  RefreshCw
} from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'

import {
  BackButton,
  ExportAppDataModal,
  Header,
  ImportAppDataModal,
  Screen
} from '@/components'
import { useAuth, useSync } from '@/contexts'
import { formatSyncTime } from '@/lib'
import { getSyncDiagnostics } from '@/services'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsInfoRow
} from './settings-ui'

type SectionDataProps = {
  isOpen: boolean
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

  useEffect(() => {
    if (!isOpen || !user) return
    void getSyncDiagnostics().then(d =>
      setDiagnostics({ lastPulledAt: d.lastPulledAt, wsState: d.wsState })
    )
  }, [isOpen, user, status, lastSyncedAt])

  const statusLabel = !isOnline
    ? 'Offline'
    : status === 'syncing'
      ? 'Syncing…'
      : status === 'error'
        ? 'Sync error'
        : 'Up to date'

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Data & Sync</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
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
              <span className="flex items-center gap-2 text-gray-700">
                {isOnline ? <Cloud size={18} /> : <CloudOff size={18} />}
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={syncNow}
                disabled={!isOnline || status === 'syncing'}
                className="flex items-center gap-1 text-purple-600 disabled:opacity-50"
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
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-gray-600"
            >
              <span>Advanced</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {advancedOpen && (
              <div className="px-4 pb-3.5 text-xs text-gray-400 flex flex-col gap-1">
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
                  <span className="text-red-400">Error: {lastError}</span>
                )}
                {failedOps.length > 0 && (
                  <span className="text-amber-600">
                    {failedOps.length} failed op
                    {failedOps.length === 1 ? '' : 's'} (dead-letter)
                  </span>
                )}
              </div>
            )}
          </SettingsGroup>
        )}
      </div>

      <AnimatePresence>
        {isImportModalOpen && (
          <ImportAppDataModal onClose={() => setIsImportModalOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isExportModalOpen && (
          <ExportAppDataModal onClose={() => setIsExportModalOpen(false)} />
        )}
      </AnimatePresence>
    </Screen>
  )
}
