import { useAuth } from '@/contexts'
import {
  SettingsActionRow,
  SettingsGroup
} from './settings-ui'

export default function SectionPrivacy() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup label="How we use your data">
        <p className="px-4 py-3.5 text-sm text-gray-600 leading-relaxed">
          Study data (topics and cards) is stored on this device. When you sign
          in, it syncs to your account so you can study on other devices.
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
  )
}
