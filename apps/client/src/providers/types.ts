import type {
  Mutation,
  PullDelta,
  PushAck,
  TopicConflictResolved
} from '@spaced-rep/sync-protocol'
import type { AuthSession, AuthUser } from '@/lib/auth-storage'
import type {
  SubscriptionSnapshot,
  UserLearningSettings,
  UserNotificationSettings,
  UserPreferences,
  UserSettingsDocument
} from '@/types/settings.types'

export interface AuthCapabilities {
  google: boolean
  passkey: boolean
  emailOtp: boolean
}

export interface AuthPort {
  capabilities: AuthCapabilities
  getSession(): Promise<AuthSession | null>
  getCurrentUser(): Promise<AuthUser | null>
  getAccessToken(): Promise<string | null>
  refreshSession(): Promise<AuthSession | null>
  loginWithGoogle(): Promise<void>
  loginWithPasskey(): Promise<void>
  requestEmailOtp(email: string, turnstileToken: string): Promise<void>
  verifyEmailOtp(email: string, token: string): Promise<AuthSession>
  logout(): Promise<void>
  onAuthStateChange(cb: (session: AuthSession | null) => void): () => void
}

export interface SyncRealtimeHandlers {
  onDelta: (delta: PullDelta) => void
  onConflict: (conflict: TopicConflictResolved) => void
  onStateChange?: (state: 'active' | 'disconnected' | 'connecting') => void
  onTokenExpired?: () => void
  onPlanRequired?: () => void
  onDeviceRevoked?: () => void
  onProtocolMismatch?: () => void
}

export interface SyncRealtimeHandle {
  connect(input: {
    deviceId: string
    lastPulledAt: string
    pendingOpCount: number
  }): Promise<void>
  disconnect(): void
  isActive(): boolean
  pushBatch?(mutations: Mutation[]): Promise<PushAck>
  updateResume?(lastPulledAt: string, pendingOpCount: number): void
}

export interface SyncPort {
  push(input: { deviceId: string; mutations: Mutation[] }): Promise<PushAck>
  pull(input: { deviceId: string; since: string }): Promise<PullDelta>
  bootstrap(input: {
    deviceId: string
    lastPulledAt: string
    pendingOpCount: number
  }): Promise<PullDelta>
  connectRealtime?(handlers: SyncRealtimeHandlers): SyncRealtimeHandle
}

export interface SettingsPort {
  fetchSettings(): Promise<UserSettingsDocument>
  fetchSubscription(): Promise<SubscriptionSnapshot>
  patchPreferences(
    body: Partial<UserPreferences> & { updatedAt: number; deviceId: string }
  ): Promise<UserPreferences & { applied?: boolean }>
  patchLearning(
    body: Partial<UserLearningSettings> & {
      updatedAt: number
      deviceId: string
    }
  ): Promise<UserLearningSettings & { applied?: boolean }>
  patchNotifications(
    body: Partial<UserNotificationSettings> & {
      updatedAt: number
      deviceId: string
    }
  ): Promise<UserNotificationSettings & { applied?: boolean }>
  fetchVapidPublicKey(): Promise<{ publicKey: string }>
  putPushSubscription(body: {
    endpoint: string
    keys: { p256dh: string; auth: string }
    deviceId?: string
  }): Promise<{ id: string; endpoint: string; deviceId: string | null }>
  deletePushSubscription(body: {
    endpoint: string
  }): Promise<{ deleted: boolean }>
}

export interface BackendPorts {
  auth: AuthPort
  sync: SyncPort
  settings: SettingsPort
}
