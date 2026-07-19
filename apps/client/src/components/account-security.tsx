import { ChevronLeft, KeyRound, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  browserSupportsWebAuthn,
  startRegistration
} from '@simplewebauthn/browser'

import { Spinner } from '@/components'
import { useAuth } from '@/contexts'
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
import { SettingsGroup, SettingsNavRow } from './settings/settings-ui'

type SecurityStep = 'menu' | 'passkeys'

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

export default function AccountSecuritySection() {
  const { session } = useAuth()
  const [step, setStep] = useState<SecurityStep>('menu')
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
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
    if (step === 'passkeys' && session) {
      void loadPasskeys()
    }
  }, [step, session, loadPasskeys])

  const handleAddPasskey = async () => {
    if (!supported) {
      toast.error('Passkeys aren’t supported in this browser')
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

      await passkeyRegisterVerify({ accessToken: token, credential })
      toast.success('Passkey added')
      await loadPasskeys()
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setIsAdding(false)
    }
  }

  const handleRevoke = async (passkeyId: string) => {
    if (!window.confirm('Remove this passkey? You can add another later.')) {
      return
    }

    const fresh = await ensureFreshSession()
    const token = fresh?.accessToken ?? getAuthSession()?.accessToken
    if (!token) {
      toast.error('Please sign in again')
      return
    }

    setRevokingId(passkeyId)
    try {
      await deletePasskey(token, passkeyId)
      toast.success('Passkey removed')
      setPasskeys(prev => prev.filter(p => p.id !== passkeyId))
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setRevokingId(null)
    }
  }

  if (step === 'passkeys') {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setStep('menu')}
          className="flex items-center gap-1 text-sm text-gray-600 self-start"
        >
          <ChevronLeft size={16} />
          Security
        </button>

        <div className="flex items-center justify-between px-1">
          <span className="font-bold">Passkeys</span>
          <button
            type="button"
            onClick={() => void handleAddPasskey()}
            disabled={!supported || isAdding}
            className="flex items-center gap-1 text-purple-600 disabled:opacity-50"
          >
            <Plus size={16} />
            {isAdding ? 'Adding…' : 'Add Passkey'}
          </button>
        </div>

        {!supported && (
          <p className="text-sm text-gray-500">
            Passkeys aren’t supported in this browser
          </p>
        )}

        {isLoading ? (
          <Spinner />
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-gray-500">
            No passkeys yet. Add one to sign in faster on this device.
          </p>
        ) : (
          <SettingsGroup>
            {passkeys.map(passkey => (
              <div
                key={passkey.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <KeyRound className="w-5 h-5 mt-0.5 shrink-0 text-gray-600" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {passkey.name || 'Passkey'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {passkey.deviceType === 'multiDevice'
                        ? 'Synced'
                        : 'This device'}
                      {' · '}
                      Last used {formatDate(passkey.lastUsedAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(passkey.id)}
                  disabled={revokingId === passkey.id}
                  className="text-red-500 p-2 disabled:opacity-50"
                  aria-label="Remove passkey"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </SettingsGroup>
        )}
      </div>
    )
  }

  return (
    <SettingsGroup label="Security">
      <SettingsNavRow
        icon={<KeyRound />}
        label="Passkeys"
        onClick={() => setStep('passkeys')}
      />
    </SettingsGroup>
  )
}
