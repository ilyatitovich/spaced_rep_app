import { isRouteErrorResponse, useRouteError } from 'react-router'

import { ErrorFallback } from '@/components'
import NotFoundPage from './not-found'

export default function RouteErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />
  }

  return <ErrorFallback error={error} />
}
