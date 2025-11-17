import { createBrowserRouter } from 'react-router'

import { NotFoundPage, HomePage, Root } from '@/pages'

export default createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <HomePage />
      }
    ]
  }
])
