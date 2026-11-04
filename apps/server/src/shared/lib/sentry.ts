import * as Sentry from '@sentry/node'
import type { ErrorEvent } from '@sentry/node'
import { env } from '../config/env.js'
import { scrubSentryEvent, type ScrubbableSentryEvent } from './sentry-scrub.js'

let initialized = false

/** No-op when SENTRY_DSN is empty — local/dev/CI stay quiet. */
export function initSentry(): void {
  if (initialized) return
  initialized = true
  if (!env.SENTRY_DSN) return

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend(event: ErrorEvent) {
      return scrubSentryEvent(
        event as unknown as ScrubbableSentryEvent
      ) as unknown as ErrorEvent
    }
  })
}

export function captureServerException(
  err: unknown,
  context?: { requestId?: unknown }
): void {
  if (!env.SENTRY_DSN) return
  if (context?.requestId !== undefined) {
    Sentry.captureException(err, { extra: { requestId: context.requestId } })
    return
  }
  Sentry.captureException(err)
}
