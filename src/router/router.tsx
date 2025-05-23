import { createBrowserRouter } from 'react-router'

import {
  topicLoader,
  cardDetailsLoader,
  draftLoader,
  editDraftCardLoader,
  levelLoader
} from './loaders'
import {
  NotFoundPage,
  HomePage,
  LevelPage,
  CardDetailsPage,
  DraftPage,
  EditDraftCardPage,
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
        element: <TopicPage />,
        loader: topicLoader
      },
      {
        path: 'topic/:topicId/draft',
        element: <DraftPage />,
        loader: draftLoader
      },
      {
        path: 'topic/:topicId/draft/:cardIndx/edit',
        element: <EditDraftCardPage />,
        loader: editDraftCardLoader
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
        element: <LevelPage />,
        loader: levelLoader
      },
      {
        path: 'topic/:topicId/:levelId/:cardIndx',
        element: <CardDetailsPage />,
        loader: cardDetailsLoader
      }
    ]
  }
])
