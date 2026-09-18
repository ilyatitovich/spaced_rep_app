import { KeyRound, Lock, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import toast from 'react-hot-toast'
import {
  browserSupportsWebAuthn,
  startRegistration
} from '@simplewebauthn/browser'

import { BackButton, Header, Screen, Spinner, Button } from '@/components'
import { useAuth, useSync } from '@/contexts'
import {
  deletePasskey,
  ensureFreshSession,
  listPasskeys,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  type PasskeySummary
} from '@/lib/api'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { getAuthSession } from '@/lib/auth-storage'
import { getDevicePlatform } from '@/lib/get-device-platform'
import Modal from '../modals/modal'
import { SettingsActionRow, SettingsGroup } from './settings-ui'

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function isWebAuthnAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  )
}

function deviceLabel(passkey: PasskeySummary): string {
  if (passkey.deviceType === 'multiDevice') return 'Synced across devices'
  if (passkey.backedUp) return 'Backed up'
  return 'This device only'
}

function isDeviceOnly(passkey: PasskeySummary): boolean {
  return passkey.deviceType !== 'multiDevice' && !passkey.backedUp
}

function defaultPasskeyName(existing: PasskeySummary[]): string {
  const platform = getDevicePlatform()
  const base =
    platform === 'iOS'
      ? 'iPhone'
      : platform === 'Other'
        ? 'This device'
        : platform
  const count = existing.filter(p => (p.name ?? '').startsWith(base)).length
  return count === 0 ? base : `${base} (${count + 1})`
}

function listFooter(passkeys: PasskeySummary[]): string {
  if (passkeys.length === 1 && isDeviceOnly(passkeys[0]!)) {
    return 'Add another passkey on a second device so you aren’t locked out if you lose this one.'
  }
  if (passkeys.length === 1) {
    return 'A second passkey on another device is a good backup.'
  }
  return 'Passkeys let you sign in with Face ID, Touch ID, or your device PIN.'
}

type SectionPasskeysProps = {
  isOpen: boolean
}

export default function SectionPasskeys({ isOpen }: SectionPasskeysProps) {
  const { user, session } = useAuth()
  const { isOnline } = useSync()
  const [, setSearchParams] = useSearchParams()
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PasskeySummary | null>(
    null
  )
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeletingLast, setIsDeletingLast] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [supported] = useState(() => browserSupportsWebAuthn())

  const loadPasskeys = useCallback(async () => {
    const fresh = await ensureFreshSession()
    const token = fresh?.accessToken ?? getAuthSession()?.accessToken
    if (!token) return

    setIsLoading(true)
    try {
      const data = await listPasskeys(token)
      setPasskeys(data.passkeys)
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && session) void loadPasskeys()
    if (!isOpen) {
      setIsDeleteOpen(false)
      setPendingDelete(null)
      setPasskeys([])
    }
  }, [isOpen, session, loadPasskeys])

  const closeDeleteModal = () => {
    if (isDeleting) return
    setIsDeleteOpen(false)
  }

  const handleSignIn = () => {
    setSearchParams(prev => {
      prev.set('auth', 'true')
      return new URLSearchParams(prev)
    })
  }

  const handleAddPasskey = async () => {
    if (!supported) {
      toast.error('Passkeys aren’t supported in this browser')
      return
    }
    if (!isOnline) {
      toast.error('You’re offline — try again when connected')
      return
    }

    const fresh = await ensureFreshSession()
    const token = fresh?.accessToken ?? getAuthSession()?.accessToken
    if (!token) {
      toast.error('Please sign in again')
      return
    }

    setIsAdding(true)
    try {
      const options = await passkeyRegisterOptions(token)
      let credential
      try {
        credential = await startRegistration({ optionsJSON: options })
      } catch (err) {
        if (isWebAuthnAbort(err)) {
          toast.error('Passkey registration was cancelled')
          return
        }
        throw err
      }

      await passkeyRegisterVerify({
        accessToken: token,
        credential,
        name: defaultPasskeyName(passkeys)
      })
      toast.success('Passkey added')
      await loadPasskeys()
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setIsAdding(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return

    const fresh = await ensureFreshSession()
    const token = fresh?.accessToken ?? getAuthSession()?.accessToken
    if (!token) {
      toast.error('Please sign in again')
      return
    }

    setIsDeleting(true)
    try {
      await deletePasskey(token, pendingDelete.id)
      toast.success('Passkey removed')
      setIsDeleteOpen(false)
      setPasskeys(prev => prev.filter(p => p.id !== pendingDelete.id))
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Passkeys</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        {!user ? (
          <SettingsGroup footer="Sign in to add and manage passkeys for faster login.">
            <SettingsActionRow
              icon={<Lock size={18} />}
              label="Sign in"
              onClick={handleSignIn}
            />
          </SettingsGroup>
        ) : !supported ? (
          <p className="text-sm text-foreground-muted px-1">
            Passkeys aren’t supported in this browser.
          </p>
        ) : isLoading ? (
          <Spinner />
        ) : passkeys.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 px-4 text-center">
            <div className="w-14 h-14 rounded-full border border-border flex items-center justify-center text-foreground-muted">
              <KeyRound size={28} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-bold">No passkeys yet</p>
              <p className="text-sm text-foreground-muted">
                Add a passkey to sign in with Face ID, Touch ID, or your device
                PIN — no password needed.
              </p>
            </div>
            <Button
              variant="link"
              className="gap-2"
              onClick={() => void handleAddPasskey()}
              disabled={isAdding || !isOnline}
            >
              <Plus size={18} />
              {isAdding ? 'Adding…' : 'Add passkey'}
            </Button>
          </div>
        ) : (
          <>
            <SettingsGroup
              label={`${passkeys.length} passkey${passkeys.length === 1 ? '' : 's'}`}
              footer={listFooter(passkeys)}
            >
              {passkeys.map(passkey => (
                <div
                  key={passkey.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <KeyRound
                    size={18}
                    className="shrink-0 text-foreground-muted mt-0.5 self-start"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {passkey.name || 'Passkey'}
                    </p>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      {deviceLabel(passkey)}
                    </p>
                    <p className="text-xs text-foreground-subtle mt-0.5">
                      Added {formatDate(passkey.createdAt)}
                      {' · '}
                      Last used {formatDate(passkey.lastUsedAt)}
                    </p>
                  </div>
                  <Button
                    variant="dangerLink"
                    className="p-2 shrink-0"
                    onClick={() => {
                      setPendingDelete(passkey)
                      setIsDeletingLast(passkeys.length === 1)
                      setIsDeleteOpen(true)
                    }}
                    aria-label={`Remove ${passkey.name || 'passkey'}`}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              ))}
            </SettingsGroup>

            <SettingsGroup footer="Use a different device or security key when adding another.">
              <SettingsActionRow
                icon={<Plus size={18} />}
                label={isAdding ? 'Adding…' : 'Add another passkey'}
                onClick={() => void handleAddPasskey()}
                disabled={isAdding || !isOnline}
              />
            </SettingsGroup>
          </>
        )}
      </div>

      <Modal
        isOpen={isDeleteOpen}
        onClose={closeDeleteModal}
        title="Remove passkey?"
      >
        <p className="text-foreground-muted text-center mb-6">
          {isDeletingLast ? (
            <>
              This is your only passkey. You’ll need Google or email to sign in
              until you add another.
            </>
          ) : (
            <>
              Devices that used{' '}
              <span className="font-medium">
                {pendingDelete?.name || 'this passkey'}
              </span>{' '}
              won’t be able to sign in with it anymore.
            </>
          )}
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={closeDeleteModal}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => void handleConfirmDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      </Modal>
    </Screen>
  )
}
