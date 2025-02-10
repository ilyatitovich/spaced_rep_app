import Home, { loader as homeLoader } from '@/pages/Home/Home'
import Root from '@/pages/Root/Root'
import { createBrowserRouter, RouterProvider } from 'react-router'

import CardDetails, {
  loader as cardDetailsLoader
} from './pages/CardDetails/CardDetails'
import Draft, { loader as draftLoader } from './pages/Draft/Draft'
import EditDraftCard, {
  loader as editDraftCardLoader
} from './pages/EditDraftCard/EditDraftCard'
import Error404 from './pages/Error404/Error404'
import Level, { loader as levelLoader } from './pages/Level/Level'
import NewCard, { loader as newCardLoader } from './pages/NewCard/NewCard'
import NewTopic from './pages/NewTopic/NewTopic'
import Test, { loader as testLoader } from './pages/Test/Test'
import Topic, { loader as topicLoader } from './pages/Topic/Topic'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <Error404 />,
    children: [
      {
        index: true,
        element: <Home />,
        loader: homeLoader
      },
      {
        path: 'new-topic',
        element: <NewTopic />
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
        path: 'topic/:topicId/new-card',
        element: <NewCard />,
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

export default function App() {
  return <RouterProvider router={router} />
}
