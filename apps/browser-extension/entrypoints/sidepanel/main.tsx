import { createRoot } from 'react-dom/client'
import App from './App'
import '../../src/styles.css'

const sidepanelPort = chrome.runtime.connect({ name: 'sidepanel' })
window.addEventListener('pagehide', () => sidepanelPort.disconnect())
createRoot(document.getElementById('app')!).render(<App />)
