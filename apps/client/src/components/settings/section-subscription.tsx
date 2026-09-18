import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { BackButton, Header, Screen } from '@/components'
import { useAuth } from '@/contexts'
import {
  createBillingCheckout,
  ensureFreshSession,
  fetchSyncDevices,
  revokeSyncDevice,
  type SyncDeviceSummary
} from '@/lib/api'
import {
  BILLING_INTERVAL_OPTIONS,
  DEFAULT_BILLING_INTERVAL,
  formatProPrice,
  PRO_DEVICE_LIMIT,
  type BillingInterval
} from '@/lib/billing-product'
import { isPlanEntitled } from '@/lib/settings'
import { getDeviceId } from '@/services'
import { useSettingsStore } from '@/store'
import type { PlanTier, SubscriptionStatus } from '@/types/settings.types'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsInfoRow,
  SettingsSegmentedRow
} from './settings-ui'

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_plus: 'Pro+'
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  expired: 'Expired',
  incomplete: 'Incomplete',
  paused: 'Paused',
  unpaid: 'Unpaid'
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

type SectionSubscriptionProps = {
  isOpen: boolean
}

export default function SectionSubscription({
  isOpen
}: SectionSubscriptionProps) {
  const { user } = useAuth()
  const settings = useSettingsStore(s => s.settings)
  const refreshSubscription = useSettingsStore(s => s.refreshSubscription)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    DEFAULT_BILLING_INTERVAL
  )
  const [devices, setDevices] = useState<SyncDeviceSummary[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const loadDevices = useCallback(async () => {
    const session = await ensureFreshSession()
    if (!session) return
    const [result, deviceId] = await Promise.all([
      fetchSyncDevices(session.accessToken),
      getDeviceId()
    ])
    setDevices(result.devices)
    setCurrentDeviceId(deviceId)
  }, [])

  useEffect(() => {
    if (isOpen && user) {
      void refreshSubscription()
      void loadDevices().catch(() => toast.error('Could not load devices'))
    }
    if (!isOpen) setDevices([])
  }, [isOpen, user, refreshSubscription, loadDevices])

  const handleUpgrade = async () => {
    const session = await ensureFreshSession()
    if (!session) return
    setIsUpgrading(true)
    try {
      const { url } = await createBillingCheckout(session.accessToken, {
        interval: billingInterval
      })
      if (
        url.startsWith('http') &&
        !url.startsWith(window.location.origin)
      ) {
        window.location.assign(url)
        return
      }
      await refreshSubscription()
    } catch {
      toast.error('Could not start checkout')
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleRevokeDevice = async (deviceId: string) => {
    if (!currentDeviceId) return
    const session = await ensureFreshSession()
    if (!session) return
    try {
      const result = await revokeSyncDevice(session.accessToken, {
        deviceId,
        currentDeviceId
      })
      if (result.revoked) {
        setDevices(prev => prev.filter(device => device.id !== deviceId))
        toast.success('Device revoked')
      }
    } catch {
      toast.error('Could not revoke device')
    }
  }

  const sub = settings?.subscription
  const plan = sub?.plan ?? 'free'
  const isEntitled = sub ? isPlanEntitled(sub, 'pro') : false
  const purchasedPaid = plan === 'pro' || plan === 'pro_plus'

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Subscription</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        {!user ? (
          <SettingsGroup footer="Sign in to subscribe when you want cloud sync or study reminders. The local app stays free.">
            <SettingsInfoRow label="Plan" value="Free" />
          </SettingsGroup>
        ) : (
          <>
            <SettingsGroup
              label="Current plan"
              footer={
                isEntitled
                  ? undefined
                  : 'Free includes the full local study app. Sync and notifications unlock with Pro — no paywall at sign-in.'
              }
            >
              <SettingsInfoRow
                label="Plan"
                value={sub ? PLAN_LABELS[sub.plan] : 'Free'}
              />
              <SettingsInfoRow
                label="Status"
                value={sub ? STATUS_LABELS[sub.status] : 'Active'}
              />
              {sub?.trialEndsAt != null && (
                <SettingsInfoRow
                  label="Trial ends"
                  value={formatDate(sub.trialEndsAt)}
                />
              )}
              {sub?.endsAt != null && (
                <SettingsInfoRow
                  label="Access until"
                  value={formatDate(sub.endsAt)}
                />
              )}
              {sub?.currentPeriodEnd != null && sub.endsAt == null && (
                <SettingsInfoRow
                  label="Renews"
                  value={formatDate(sub.currentPeriodEnd)}
                />
              )}
              {sub?.cancelAtPeriodEnd && (
                <SettingsInfoRow label="Cancels" value="At period end" />
              )}
            </SettingsGroup>

            {!isEntitled && (
              <SettingsGroup
                label="Pro"
                footer={`Cloud sync, study notifications, and up to ${PRO_DEVICE_LIMIT} devices. Prices shown before tax.`}
              >
                <SettingsSegmentedRow
                  label="Billing"
                  value={billingInterval}
                  options={BILLING_INTERVAL_OPTIONS}
                  onChange={value =>
                    setBillingInterval(value as BillingInterval)
                  }
                />
                <SettingsInfoRow
                  label="Selected"
                  value={formatProPrice(billingInterval)}
                />
                <SettingsActionRow
                  label={`Upgrade — ${formatProPrice(billingInterval)}`}
                  onClick={() => void handleUpgrade()}
                  disabled={isUpgrading}
                />
              </SettingsGroup>
            )}

            {purchasedPaid && isEntitled && (
              <SettingsGroup footer="Billing management is coming soon.">
                <SettingsActionRow
                  label="Manage billing"
                  onClick={() => {}}
                  disabled
                />
              </SettingsGroup>
            )}

            {devices.length > 0 && (
              <SettingsGroup
                label="Sync devices"
                footer={`Pro supports up to ${PRO_DEVICE_LIMIT} active devices. Inactive devices age out after 30 days.`}
              >
                {devices.map(device => (
                  <SettingsActionRow
                    key={device.id}
                    label={
                      device.id === currentDeviceId
                        ? 'This device'
                        : device.name ||
                          device.userAgent ||
                          `Device ${device.id.slice(0, 8)}`
                    }
                    onClick={() => void handleRevokeDevice(device.id)}
                    disabled={device.id === currentDeviceId}
                  />
                ))}
              </SettingsGroup>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
