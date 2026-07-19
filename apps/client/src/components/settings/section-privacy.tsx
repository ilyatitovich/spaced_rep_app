import { BackButton, Header, Screen } from '@/components'
import { useAuth } from '@/contexts'
import { SettingsActionRow, SettingsGroup } from './settings-ui'

type SectionPrivacyProps = {
  isOpen: boolean
}

export default function SectionPrivacy({ isOpen }: SectionPrivacyProps) {
  const { user } = useAuth()

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Privacy</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        <SettingsGroup label="How we use your data">
          <p className="px-4 py-3.5 text-sm text-gray-600 leading-relaxed">
            Study data (topics and cards) is stored on this device. When you
            sign in, it syncs to your account so you can study on other devices.
            Preferences and learning settings sync the same way. We don’t sell
            your data.
          </p>
        </SettingsGroup>

        <SettingsGroup
          label="Your rights"
          footer="Account deletion and data-erasure requests are coming soon."
        >
          <SettingsActionRow
            label="Delete account"
            onClick={() => {}}
            disabled={!user}
            destructive
          />
          <SettingsActionRow
            label="Request data erasure"
            onClick={() => {}}
            disabled={!user}
            destructive
          />
        </SettingsGroup>
      </div>
    </Screen>
  )
}
