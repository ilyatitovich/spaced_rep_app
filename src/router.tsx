import { createBrowserRouter } from 'react-router'

import {
  NotFoundPage,
  HomePage,
  LevelPage,
  EditCardPage,
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
      {
        path: 'topic/:topicId/:levelId/:cardId/edit',
        element: <EditCardPage />
      },
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
    ]
  }
])
