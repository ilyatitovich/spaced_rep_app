import { createBrowserRouter } from 'react-router'

import { NotFoundPage, HomePage, EditCardPage, Root } from '@/pages'

export default createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'topic/:topicId/:levelId/:cardId/edit',
        element: <EditCardPage />
      }
    ]
  }
])
