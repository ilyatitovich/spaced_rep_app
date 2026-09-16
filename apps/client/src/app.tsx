import { Toaster } from 'react-hot-toast'
import { RouterProvider } from 'react-router'

import router from './router'
import { AuthProvider, SyncProvider } from '@/contexts'
import { PwaUpdateProvider } from '@/hooks'

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <PwaUpdateProvider>
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
        </PwaUpdateProvider>
      </SyncProvider>
    </AuthProvider>
  )
}
