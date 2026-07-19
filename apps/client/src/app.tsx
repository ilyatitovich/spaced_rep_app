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
            success: {
              iconTheme: {
                primary: 'var(--color-success)',
                secondary: 'var(--color-success-foreground)'
              }
            }
          }}
        />
        <RouterProvider router={router} />
      </SyncProvider>
    </AuthProvider>
  )
}
