import './instrument'

import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './app'
import { ErrorFallback } from '@/components'
import { requestPersistentStorage } from '@/lib/storage-usage'
import { bootstrapLocalSettings } from './services/settings.service'
import { hydrateStudyMemory } from './services/study-memory'

async function bootstrap(): Promise<void> {
  const root = createRoot(document.getElementById('root')!)
  const [settings, study] = await Promise.allSettled([
    bootstrapLocalSettings(),
    hydrateStudyMemory()
  ])

  // Settings fall back to defaults, so a failure there must not block the app.
  if (settings.status === 'rejected') {
    console.error('Failed to bootstrap settings:', settings.reason)
  }

  // Without study data the UI would show an empty library while IndexedDB still
  // holds the real one, and writes would collide with it. Fail loudly instead.
  if (study.status === 'rejected') {
    console.error('Failed to hydrate study memory:', study.reason)
    root.render(
      <ErrorFallback
        error={study.reason}
        onRetry={() => window.location.reload()}
      />
    )
    return
  }

  void requestPersistentStorage()

  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void bootstrap()
