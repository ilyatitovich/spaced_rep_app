import { useEffect } from 'react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType
} from 'react-router'
import * as Sentry from '@sentry/react'
import { replayIntegration } from '@sentry/replay'

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const isProd = import.meta.env.PROD

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION || undefined,
  integrations: [
    Sentry.reactRouterBrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes
    }),
    replayIntegration()
  ],
  tracesSampleRate: isProd ? 0.2 : 1.0,
  tracePropagationTargets: ['localhost', ...(apiUrl ? [apiUrl] : [])],
  replaysSessionSampleRate: isProd ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0
})
