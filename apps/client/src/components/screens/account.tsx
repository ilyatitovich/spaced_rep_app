import {
  Bell,
  BookOpen,
  ChevronLeft,
  Cloud,
  CreditCard,
  Lock,
  LogOut,
  Settings2,
  Shield,
  TriangleAlert,
  UserRound
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import toast from 'react-hot-toast'

import {
  BackButton,
  Button,
  Header,
  Screen,
  Spinner
} from '@/components'
import { useAuth, useSync } from '@/contexts'
import { useSettingsStore } from '@/store'
import type { PlanTier } from '@/types/settings.types'
import { SettingsGroup, SettingsNavRow } from '../settings/settings-ui'
import SectionAccount from '../settings/section-account'
import SectionPreferences from '../settings/section-preferences'
import SectionLearning from '../settings/section-learning'
import SectionNotifications from '../settings/section-notifications'
import SectionSubscription from '../settings/section-subscription'
import SectionPrivacy from '../settings/section-privacy'
import SectionData from '../settings/section-data'

type SettingsView =
  | 'hub'
  | 'account'
  | 'preferences'
  | 'learning'
  | 'notifications'
  | 'subscription'
  | 'privacy'
  | 'data'

const VIEW_TITLES: Record<SettingsView, string> = {
  hub: 'Settings',
  account: 'Account',
  preferences: 'Preferences',
  learning: 'Learning',
  notifications: 'Notifications',
  subscription: 'Subscription',
  privacy: 'Privacy',
  data: 'Data & Sync'
}

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_plus: 'Pro+'
}

type AccountScreenProps = {
  isOpen: boolean
}

export default function AccountScreen({ isOpen }: AccountScreenProps) {
  const { user, isLoading, isConfigured, signOut } = useAuth()
  const { isOnline } = useSync()
  const settings = useSettingsStore(s => s.settings)
  const [, setSearchParams] = useSearchParams()
  const [view, setView] = useState<SettingsView>('hub')

  useEffect(() => {
    if (!isOpen) setView('hub')
  }, [isOpen])

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

  const plan = settings?.subscription.plan ?? 'free'
  const planLabel = PLAN_LABELS[plan]
  const displayName = user?.email ?? 'Guest'
  const initial = (user?.email?.[0] ?? 'G').toUpperCase()

  const renderHub = () => {
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

    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => setView('account')}
          className="border border-gray-300 rounded-xl p-4 flex items-center gap-3 text-left"
        >
          <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{displayName}</p>
            <p className="text-sm text-gray-500">{planLabel} plan</p>
          </div>
        </button>

        <SettingsGroup label="General">
          <SettingsNavRow
            icon={<UserRound />}
            label="Account"
            onClick={() => setView('account')}
          />
          <SettingsNavRow
            icon={<Settings2 />}
            label="Preferences"
            value={
              settings?.preferences.theme === 'system'
                ? 'System'
                : settings?.preferences.theme === 'dark'
                  ? 'Dark'
                  : 'Light'
            }
            onClick={() => setView('preferences')}
          />
          <SettingsNavRow
            icon={<BookOpen />}
            label="Learning"
            onClick={() => setView('learning')}
          />
          <SettingsNavRow
            icon={<Bell />}
            label="Notifications"
            onClick={() => setView('notifications')}
          />
        </SettingsGroup>

        <SettingsGroup label="Plan & privacy">
          <SettingsNavRow
            icon={<CreditCard />}
            label="Subscription"
            value={planLabel}
            onClick={() => setView('subscription')}
          />
          <SettingsNavRow
            icon={<Shield />}
            label="Privacy"
            onClick={() => setView('privacy')}
          />
          <SettingsNavRow
            icon={<Cloud />}
            label="Data & Sync"
            onClick={() => setView('data')}
          />
        </SettingsGroup>

        <SettingsGroup>
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 font-medium text-red-500"
            >
              <LogOut size={18} />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignInOpen}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 font-medium text-purple-600"
            >
              <Lock size={18} />
              Sign in
            </button>
          )}
        </SettingsGroup>
      </div>
    )
  }

  const renderSection = () => {
    switch (view) {
      case 'account':
        return <SectionAccount />
      case 'preferences':
        return <SectionPreferences />
      case 'learning':
        return <SectionLearning />
      case 'notifications':
        return <SectionNotifications />
      case 'subscription':
        return <SectionSubscription />
      case 'privacy':
        return <SectionPrivacy />
      case 'data':
        return <SectionData />
      default:
        return null
    }
  }

  return (
    <Screen isOpen={isOpen}>
      <div className="h-full bg-background flex flex-col">
        <Header>
          {view === 'hub' ? (
            <BackButton />
          ) : (
            <Button onClick={() => setView('hub')} ariaLabel="Back to Settings">
              <ChevronLeft size={28} />
            </Button>
          )}
          <span className="font-bold">{VIEW_TITLES[view]}</span>
          <span className="w-7" aria-hidden />
        </Header>

        <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
          {view === 'hub' ? renderHub() : renderSection()}
        </div>
      </div>
    </Screen>
  )
}
