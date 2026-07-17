import {
  ArrowUpFromLine,
  Cloud,
  CloudOff,
  Download,
  LogOut,
  RefreshCw,
  Lock,
  TriangleAlert
} from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'

import AccountSecuritySection from '../account-security'
import {
  BackButton,
  ExportAppDataModal,
  Header,
  ImportAppDataModal,
  Screen,
  Spinner
} from '@/components'
import { useAuth, useSync } from '@/contexts'
import { getSyncDiagnostics } from '@/services'
import { useSearchParams } from 'react-router'
import toast from 'react-hot-toast'

type AccountScreenProps = {
  isOpen: boolean
}

function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return 'Never'

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function AccountScreen({ isOpen }: AccountScreenProps) {
  const { user, isLoading, isConfigured, signOut } = useAuth()
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
  const [diagnostics, setDiagnostics] = useState<{
    lastPulledAt: string
    wsState: string
  } | null>(null)

  const [_, setSearchParams] = useSearchParams()

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

  const handleSignInOpen = () => {
    if (!isOnline) {
      toast('Server temporarily unavailable', {
        icon: <TriangleAlert className="text-yellow-600" size={20} />
      })
      return
    }
    setSearchParams(prev => {
      prev.set('auth', 'true')
      return new URLSearchParams(prev)
    })
  }

  return (
    <Screen isOpen={isOpen}>
      <div className="h-full bg-background flex flex-col overflow-hidden">
        <Header>
          <BackButton />
          <span className="font-bold">Account</span>
        </Header>

        <div className="flex flex-col gap-8 px-4 mt-8">
          {!isConfigured ? (
            <p className="text-center text-gray-500">
              Cloud sync is not configured for this build.
            </p>
          ) : isLoading ? (
            <Spinner />
          ) : user ? (
            <>
              <div className="flex flex-col items-center gap-2">
                <span className="font-bold">{user.email}</span>
              </div>

              <div className="border border-gray-300 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-700">
                    {isOnline ? <Cloud size={18} /> : <CloudOff size={18} />}
                    {statusLabel}
                  </span>
                  <button
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
                <span className="text-sm text-gray-500">
                  Last synced: {formatSyncTime(lastSyncedAt)}
                </span>
                <div className="text-xs text-gray-400 flex flex-col gap-1">
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
              </div>

              <AccountSecuritySection />

              <button
                onClick={signOut}
                className="border border-gray-300 p-4 rounded-xl flex gap-2 justify-center items-center text-red-500"
              >
                <LogOut />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <button
              className="border border-gray-300 p-4 rounded-xl flex gap-2 justify-center items-center"
              onClick={handleSignInOpen}
            >
              <Lock size={18} />
              Sign in
            </button>
          )}

          <div className="flex flex-col gap-4">
            <span className="font-bold">Data</span>
            <button
              className="border border-gray-300 p-4 rounded-xl flex gap-2 justify-center items-center"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Download size={18} />
              <span>Import all data</span>
            </button>
            <button
              className="border border-gray-300 p-4 rounded-xl flex gap-2 justify-center items-center"
              onClick={() => setIsExportModalOpen(true)}
            >
              <ArrowUpFromLine size={18} />
              <span>Export all data</span>
            </button>
          </div>
        </div>
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
