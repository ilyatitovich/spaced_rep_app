import { isAppUrl } from '../src/lib/app-url'
import type { RawCapture } from '../src/lib/capture'
import { PENDING_KEY } from '../src/lib/keys'
import { flushOutbox } from '../src/lib/sync'
import type { RuntimeMessage, SideName } from '../src/types'

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  })
  if (!tab?.id || !tab.windowId) throw new Error('No active web page')
  if (!/^https?:/.test(tab.url ?? ''))
    throw new Error('This page cannot be captured')
  if (isAppUrl(tab.url)) throw new Error('Use the extension on other sites')
  return tab
}

async function send(message: RuntimeMessage): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: message })
  await chrome.runtime.sendMessage(message).catch(() => undefined)
}

async function captureSelection(side: SideName): Promise<void> {
  const tab = await activeTab()
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null
      const parent =
        range?.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range?.commonAncestorContainer.parentElement
      const code = parent?.closest('pre, code')
      const fragment = range?.cloneContents()
      const wrapper = document.createElement('div')
      if (fragment) wrapper.append(fragment)
      return {
        html: wrapper.innerHTML,
        text: selection?.toString() ?? '',
        code: code ? selection?.toString() : undefined,
        title: document.title,
        url: location.href
      }
    }
  })
  await send({ type: 'RAW_CAPTURE', side, raw: result as RawCapture })
}

async function captureScreenshot(side: SideName): Promise<void> {
  const tab = await activeTab()
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'jpeg',
    quality: 82
  })
  await send({
    type: 'RAW_CAPTURE',
    side,
    raw: {
      imageUrl: dataUrl,
      title: tab.title ?? '',
      url: tab.url ?? ''
    }
  })
}

function openPanel(tab?: chrome.tabs.Tab): void {
  if (!tab?.id || isAppUrl(tab.url)) return
  void chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: 'sidepanel.html',
    enabled: true
  })
  void chrome.sidePanel.open({ tabId: tab.id })
}

export default defineBackground(() => {
  void chrome.sidePanel.setOptions({ enabled: false })

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'spaced-rep-selection',
        title: 'Add selection to flashcard',
        contexts: ['selection']
      })
      chrome.contextMenus.create({
        id: 'spaced-rep-image',
        title: 'Add image to flashcard',
        contexts: ['image']
      })
      chrome.contextMenus.create({
        id: 'spaced-rep-audio',
        title: 'Add audio to flashcard',
        contexts: ['audio']
      })
    })
    chrome.alarms.create('sync-outbox', { periodInMinutes: 5 })
  })

  chrome.action.onClicked.addListener(tab => openPanel(tab))

  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    const url = info.url ?? tab.url
    if (!url || !isAppUrl(url)) return
    void chrome.sidePanel.setOptions({ tabId, enabled: false })
  })

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (isAppUrl(tab?.url ?? info.pageUrl)) return
    if (info.srcUrl) {
      const origin = `${new URL(info.srcUrl).origin}/*`
      await chrome.permissions.request({ origins: [origin] }).catch(() => false)
    }
    openPanel(tab)
    const raw: RawCapture = {
      html: info.selectionText,
      text: info.selectionText,
      imageUrl: info.mediaType === 'image' ? info.srcUrl : undefined,
      audioUrl: info.mediaType === 'audio' ? info.srcUrl : undefined,
      title: tab?.title ?? '',
      url: tab?.url ?? info.pageUrl ?? ''
    }
    await send({ type: 'RAW_CAPTURE', side: 'front', raw })
  })

  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === 'CAPTURE_SELECTION')
      void captureSelection(message.side)
    if (message.type === 'CAPTURE_SCREENSHOT')
      void captureScreenshot(message.side)
    if (message.type === 'SYNC_NOW') void flushOutbox()
  })
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'sync-outbox') void flushOutbox()
  })
  void flushOutbox()
})
