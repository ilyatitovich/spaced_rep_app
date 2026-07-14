import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react'

import { AuthMethods, BackButton, Header, Screen, Spinner } from '@/components'
import { useAuth, useSync } from '@/contexts'

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
  const { status, lastSyncedAt, isOnline, syncNow } = useSync()

  const statusLabel = !isOnline
    ? 'Offline'
    : status === 'syncing'
      ? 'Syncing…'
      : status === 'error'
        ? 'Sync error'
        : 'Up to date'

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
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url as string}
                    alt=""
                    className="w-16 h-16 rounded-full"
                  />
                )}
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
              </div>

              <button
                onClick={signOut}
                className="border border-gray-300 p-4 rounded-xl flex gap-2 justify-center items-center text-red-500"
              >
                <LogOut />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <AuthMethods />
          )}
        </div>
      </div>
    </Screen>
  )
}
