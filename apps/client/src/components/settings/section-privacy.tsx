import { useState } from 'react'
import { BackButton, Header, Screen } from '@/components'
import { useAuth } from '@/contexts'
import { deleteAccount } from '@/lib'
import { SettingsActionRow, SettingsGroup } from './settings-ui'

interface SectionPrivacyProps {
  isOpen: boolean
}

export default function SectionPrivacy({ isOpen }: SectionPrivacyProps) {
  const { user, session, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDeleteAccount() {
    const accessToken = session?.accessToken
    if (!accessToken || busy) return

    const confirmed = window.confirm(
      'Delete your account and all synced study data? This cannot be undone.'
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      await deleteAccount(accessToken)
      // The account is gone server-side; there is nothing left to sync to.
      await signOut({ discardUnsynced: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account')
      setBusy(false)
    }
  }

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Privacy</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        <SettingsGroup label="How we use your data">
          <p className="px-4 py-3.5 text-sm text-foreground-muted leading-relaxed">
            Study data (topics and cards) is stored on this device. When you
            sign in, it syncs to your account so you can study on other devices.
            Preferences and learning settings sync the same way. We don’t sell
            your data.
          </p>
        </SettingsGroup>

        <SettingsGroup
          label="Your rights"
          footer="Deleting your account removes your cloud data and media. Local data on this device is cleared on sign-out."
        >
          <SettingsActionRow
            label={busy ? 'Deleting…' : 'Delete account'}
            onClick={() => void handleDeleteAccount()}
            disabled={!user || busy}
            destructive
          />
          {error ? (
            <p className="px-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </SettingsGroup>
      </div>
    </Screen>
  )
}
