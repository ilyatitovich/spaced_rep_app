import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { RouterProvider } from 'react-router'

import router from './router'
import { popStateHandler } from './stores'

export default function App() {
  useEffect(() => {
    history.replaceState({ screen: 'root' }, '')
    window.addEventListener('popstate', popStateHandler)
    return () => window.removeEventListener('popstate', popStateHandler)
  }, [])
  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <RouterProvider router={router} />
    </>
  )
}
