import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './app'
import { TopicProvider } from './contexts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TopicProvider>
      <App />
    </TopicProvider>
  </StrictMode>
)
