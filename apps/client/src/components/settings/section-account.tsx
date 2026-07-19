import { Lock, LogOut, TriangleAlert } from 'lucide-react'
import { useSearchParams } from 'react-router'
import toast from 'react-hot-toast'

import AccountSecuritySection from '../account-security'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsInfoRow
} from './settings-ui'
import { useAuth, useSync } from '@/contexts'
import { Spinner } from '@/components'

export default function SectionAccount() {
  const { user, isLoading, isConfigured, signOut } = useAuth()
  const { isOnline } = useSync()
  const [, setSearchParams] = useSearchParams()

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

  if (!isConfigured) {
    return (
      <p className="text-center text-gray-500">
        Cloud sync is not configured for this build.
      </p>
    )
  }

  if (isLoading) {
    return <Spinner />
  }

  if (!user) {
    return (
      <SettingsGroup>
        <SettingsActionRow
          icon={<Lock size={18} />}
          label="Sign in"
          onClick={handleSignInOpen}
        />
      </SettingsGroup>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup label="Profile">
        <SettingsInfoRow label="Email" value={user.email} />
      </SettingsGroup>

      <AccountSecuritySection />

      <SettingsGroup>
        <SettingsActionRow
          icon={<LogOut size={18} />}
          label="Sign out"
          onClick={() => void signOut()}
          destructive
        />
      </SettingsGroup>
    </div>
  )
}
