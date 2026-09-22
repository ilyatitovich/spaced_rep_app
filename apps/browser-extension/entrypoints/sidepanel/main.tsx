import { createRoot } from 'react-dom/client'
import App from './App'
import '@ext/styles.css'

const container = document.getElementById('app')

if (!container) {
  throw new Error('Container not found')
}

createRoot(container).render(<App />)
