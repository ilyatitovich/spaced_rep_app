import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import CardDetails, { loader as cardDetailsLoader } from './pages/card-details'
import Draft, { loader as draftLoader } from './pages/draft'
import EditDraftCard, {
  loader as editDraftCardLoader
} from './pages/edit-draft-card'
import Error404 from './pages/error-404'
import Home, { loader as homeLoader } from './pages/home'
import Level, { loader as levelLoader } from './pages/level'
import NewCard, { loader as newCardLoader } from './pages/new-card'
import NewTopic from './pages/new-topic'
import Root from './pages/root'
import Test, { loader as testLoader } from './pages/test'
import Topic, { loader as topicLoader } from './pages/topic'

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
