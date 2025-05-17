import { createBrowserRouter } from 'react-router'

import {
  homeLoader,
  topicLoader,
  testLoader,
  newCardLoader,
  levelLoader,
  editDraftCardLoader,
  draftLoader,
  cardDetailsLoader
} from './loaders'
import {
  Root,
  Home,
  AddTopic,
  Test,
  AddCard,
  Level,
  Error404,
  EditDraftCard,
  Draft,
  CardDetails,
  Topic
} from '@/pages'

export default createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <Error404 />,
    // hydrateFallbackElement: <div>hi</div>,
    children: [
      {
        index: true,
        element: <Home />,
        loader: homeLoader
      },
      {
        path: 'add-topic',
        element: <AddTopic />
      },
      {
        path: 'topic/:topicId',
        element: <Topic />,
        loader: topicLoader
      },
      {
        path: 'topic/:topicId/draft',
        element: <Draft />,
        loader: draftLoader
      },
      {
        path: 'topic/:topicId/draft/:cardIndx/edit',
        element: <EditDraftCard />,
        loader: editDraftCardLoader
      },
      {
        path: 'topic/:topicId/add-card',
        element: <AddCard />,
        loader: newCardLoader
      },
      {
        path: 'topic/:topicId/test',
        element: <Test />,
        loader: testLoader
      },
      {
        path: 'topic/:topicId/:levelId',
        element: <Level />,
        loader: levelLoader
      },
      {
        path: 'topic/:topicId/:levelId/:cardIndx',
        element: <CardDetails />,
        loader: cardDetailsLoader
      }
    ]
  }
])
