import { createRoot } from 'react-dom/client'
import { clearEphemeralStorage } from '@ext/lib/chrome-store'
import App from './App'
import '@ext/styles.css'

window.addEventListener('pagehide', event => {
  if (event.persisted) return
  void clearEphemeralStorage()
})

const container = document.getElementById('app')

if (!container) {
  throw new Error('Container not found')
}

createRoot(container).render(<App />)
