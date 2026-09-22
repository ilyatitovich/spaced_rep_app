import { DRAFT_KEY, PENDING_KEY } from './keys'

export async function readList<T>(key: string): Promise<T[]> {
  const stored = await chrome.storage.local.get(key)
  return Array.isArray(stored[key]) ? (stored[key] as T[]) : []
}

export async function writeList<T>(key: string, values: T[]): Promise<void> {
  await chrome.storage.local.set({ [key]: values })
}

export async function readValue(key: string): Promise<unknown> {
  const stored = await chrome.storage.local.get(key)
  return stored[key]
}

export async function writeValue(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export const removeKeys = (keys: string[]) => chrome.storage.local.remove(keys)

export const clearEphemeralStorage = () =>
  removeKeys([DRAFT_KEY, PENDING_KEY])
