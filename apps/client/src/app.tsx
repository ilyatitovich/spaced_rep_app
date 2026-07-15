import { Toaster } from 'react-hot-toast'
import { RouterProvider } from 'react-router'

import router from './router'
import { AuthProvider, SyncProvider } from '@/contexts'

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <Toaster
          toastOptions={{
            success: { iconTheme: { primary: '#00a63e', secondary: 'white' } }
          }}
        />
        <RouterProvider router={router} />
      </SyncProvider>
    </AuthProvider>
  )
}
