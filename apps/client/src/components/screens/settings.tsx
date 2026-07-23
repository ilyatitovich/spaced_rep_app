import {
  Bell,
  Cloud,
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  Settings2,
  Shield,
  TriangleAlert
} from 'lucide-react'
import { useSearchParams } from 'react-router'
import toast from 'react-hot-toast'

import { Avatar, BackButton, Header, Screen, Spinner } from '@/components'
import { useAuth, useSync } from '@/contexts'
import { useSettingsStore } from '@/store'
import type { PlanTier } from '@/types/settings.types'
import {
  SettingsGroup,
  SettingsNavRow,
  SectionPreferences,
  SectionNotifications,
  SectionSubscription,
  SectionPrivacy,
  SectionData,
  SectionPasskeys
} from '@/components/settings'

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_plus: 'Pro+'
}

const SECTION_PARAMS = [
  'preferences',
  'notifications',
  'passkeys',
  'subscription',
  'privacy',
  'data'
] as const

type SectionParam = (typeof SECTION_PARAMS)[number]

function openSection(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  section: SectionParam
) {
  setSearchParams(prev => {
    prev.set(section, 'true')
    return new URLSearchParams(prev)
  })
}

type SettingsScreenProps = {
  isOpen: boolean
}

export default function SettingsScreen({ isOpen }: SettingsScreenProps) {
  const { user, isLoading, isConfigured, signOut } = useAuth()
  const { isOnline } = useSync()
  const settings = useSettingsStore(s => s.settings)
  const [searchParams, setSearchParams] = useSearchParams()

  const isPreferencesOpen = searchParams.get('preferences') === 'true'
  const isNotificationsOpen = searchParams.get('notifications') === 'true'
  const isPasskeysOpen = searchParams.get('passkeys') === 'true'
  const isSubscriptionOpen = searchParams.get('subscription') === 'true'
  const isPrivacyOpen = searchParams.get('privacy') === 'true'
  const isDataOpen = searchParams.get('data') === 'true'

  const handleSignInOpen = () => {
    if (!isOnline) {
      toast('Server temporarily unavailable', {
        icon: <TriangleAlert className="text-warning" size={20} />
      })
      return
    }
    setSearchParams(prev => {
      prev.set('auth', 'true')
      return new URLSearchParams(prev)
    })
  }

  const plan = settings?.subscription.plan ?? 'free'
  const planLabel = PLAN_LABELS[plan]
  const displayName = user?.email ?? 'Guest'
  const avatarUrl = user?.user_metadata?.avatar_url
  const initial = (user?.email?.[0] ?? 'G').toUpperCase()

  const themeValue =
    settings?.preferences.theme === 'system'
      ? 'System'
      : settings?.preferences.theme === 'dark'
        ? 'Dark'
        : 'Light'

  return (
    <Screen isOpen={isOpen}>
      <div className="h-full bg-background flex flex-col">
        <Header>
          <BackButton />
          <span className="font-bold">Account</span>
          <span className="w-7" aria-hidden />
        </Header>

        <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
          {!isConfigured ? (
            <p className="text-center text-foreground-muted">
              Cloud sync is not configured for this build.
            </p>
          ) : isLoading ? (
            <Spinner />
          ) : (
            <>
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <Avatar url={avatarUrl} initial={initial} />
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <p className="font-bold truncate">{displayName}</p>
                  <p className="text-sm text-foreground-muted">
                    {planLabel} plan
                  </p>
                </div>
              </div>

              <SettingsGroup label="General">
                <SettingsNavRow
                  icon={<Settings2 />}
                  label="Preferences"
                  value={themeValue}
                  onClick={() => openSection(setSearchParams, 'preferences')}
                />
                <SettingsNavRow
                  icon={<Bell />}
                  label="Notifications"
                  onClick={() => openSection(setSearchParams, 'notifications')}
                />
                <SettingsNavRow
                  icon={<KeyRound />}
                  label="Passkeys"
                  onClick={() => openSection(setSearchParams, 'passkeys')}
                />
              </SettingsGroup>

              <SettingsGroup label="Plan & privacy">
                <SettingsNavRow
                  icon={<CreditCard />}
                  label="Subscription"
                  value={planLabel}
                  onClick={() => openSection(setSearchParams, 'subscription')}
                />
                <SettingsNavRow
                  icon={<Shield />}
                  label="Privacy"
                  onClick={() => openSection(setSearchParams, 'privacy')}
                />
                <SettingsNavRow
                  icon={<Cloud />}
                  label="Data & Sync"
                  onClick={() => openSection(setSearchParams, 'data')}
                />
              </SettingsGroup>

              <SettingsGroup>
                {user ? (
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 font-medium text-danger"
                  >
                    <LogOut size={18} />
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignInOpen}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 font-medium text-primary"
                  >
                    <Lock size={18} />
                    Sign in
                  </button>
                )}
              </SettingsGroup>
            </>
          )}
        </div>
      </div>

      <SectionPreferences isOpen={isPreferencesOpen} />
      <SectionNotifications isOpen={isNotificationsOpen} />
      <SectionPasskeys isOpen={isPasskeysOpen} />
      <SectionSubscription isOpen={isSubscriptionOpen} />
      <SectionPrivacy isOpen={isPrivacyOpen} />
      <SectionData isOpen={isDataOpen} />
    </Screen>
  )
}
