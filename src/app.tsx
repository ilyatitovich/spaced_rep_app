import { Toaster } from 'react-hot-toast'
import { RouterProvider } from 'react-router'

import router from './router'

export default function App() {
  return (
    <>
      <Toaster
        toastOptions={{
          success: { iconTheme: { primary: '#00a63e', secondary: 'white' } }
        }}
      />
      <RouterProvider router={router} />
    </>
  )
}
