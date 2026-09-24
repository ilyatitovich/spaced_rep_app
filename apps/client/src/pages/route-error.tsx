import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { captureException } from '@sentry/browser'

import { ErrorFallback } from '@/components'
import NotFoundPage from './not-found'

export default function RouteErrorPage() {
  const error = useRouteError()

  useEffect(() => {
    if (isRouteErrorResponse(error) && error.status === 404) return
    if (error) captureException(error)
  }, [error])

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />
  }

  return <ErrorFallback error={error} />
}
