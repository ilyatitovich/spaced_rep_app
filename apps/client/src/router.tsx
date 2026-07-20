import { createBrowserRouter } from 'react-router'

import { NotFoundPage, HomePage, Root, OAuthGoogleCallbackPage } from '@/pages'
import { StartScreen } from './components'
import { isOnboardingComplete } from './lib'
import { useState } from 'react'

function IndexRoute() {
  const [complete, setComplete] = useState(isOnboardingComplete)
  return complete ? (
    <HomePage />
  ) : (
    <StartScreen onStart={() => setComplete(true)} />
  )
}
export default createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <IndexRoute />
      },
      {
        path: 'oauth/google/callback',
        element: <OAuthGoogleCallbackPage />
      }
    ]
  }
])
