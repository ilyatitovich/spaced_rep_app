import { createBrowserRouter } from 'react-router'

import {
  NotFoundPage,
  HomePage,
  LevelPage,
  // CardDetailsPage,
  // EditDraftCardPage,
  NewCardPage,
  NewTopicPage,
  Root,
  TestPage,
  TopicPage
} from '@/pages'

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
        path: 'new-topic',
        element: <NewTopicPage />
      },
      {
        path: 'topic/:topicId',
        element: <TopicPage />
      },
      // {
      //   path: 'topic/:topicId/draft/:cardIndx/edit',
      //   element: <EditDraftCardPage />,
      // },
      {
        path: 'topic/:topicId/new-card',
        element: <NewCardPage />
      },
      {
        path: 'topic/:topicId/test',
        element: <TestPage />
      },
      {
        path: 'topic/:topicId/:levelId',
        element: <LevelPage />
      }
      // {
      //   path: 'topic/:topicId/:levelId/:cardIndx',
      //   element: <CardDetailsPage />,
      // }
    ]
  }
])
