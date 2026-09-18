import { createBrowserRouter } from 'react-router'
import { useState } from 'react'

import {
  NotFoundPage,
  HomePage,
  Root,
  OAuthGoogleCallbackPage,
  RouteErrorPage
} from '@/pages'
import { StartScreen } from './components'
import { useAuth } from './contexts'
import { isOnboardingComplete } from './lib'

function IndexRoute() {
  const { session } = useAuth()
  const [complete, setComplete] = useState(isOnboardingComplete)
  // Auth success sets session + onboarding flag, but does not remount this route —
  // so also leave start when a session appears (email OTP / passkey).
  return complete || session ? (
    <HomePage />
  ) : (
    <StartScreen onStart={() => setComplete(true)} />
  )
}
export default createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <IndexRoute />
      },
      {
        path: 'oauth/google/callback',
        element: <OAuthGoogleCallbackPage />
      },
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  }
])
