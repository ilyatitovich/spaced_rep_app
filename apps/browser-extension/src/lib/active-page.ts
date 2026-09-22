export type ActivePage = {
  title: string
  url: string
}

export async function getActivePage(): Promise<ActivePage> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  })
  return { title: tab?.title ?? '', url: tab?.url ?? '' }
}

export function subscribeActivePage(onChange: () => void): () => void {
  const handleUpdated = (
    _tabId: number,
    change: { title?: string; url?: string; status?: string }
  ) => {
    if (
      change.title !== undefined ||
      change.url !== undefined ||
      change.status === 'complete'
    ) {
      onChange()
    }
  }
  chrome.tabs.onActivated.addListener(onChange)
  chrome.tabs.onUpdated.addListener(handleUpdated)
  return () => {
    chrome.tabs.onActivated.removeListener(onChange)
    chrome.tabs.onUpdated.removeListener(handleUpdated)
  }
}
