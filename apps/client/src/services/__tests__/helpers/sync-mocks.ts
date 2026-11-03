import { vi } from 'vitest'

/**
 * Module factories shared by sync service tests. Use them lazily from a hoisted
 * `vi.mock` so the test's own `vi.fn()` consts are initialised by then:
 *
 *   vi.mock('@/providers', async () =>
 *     (await import('./helpers/sync-mocks')).providersModule({ push: pushMock, ... })
 *   )
 */

interface BackendMocks {
  push: (...args: unknown[]) => unknown
  pull: (...args: unknown[]) => unknown
  bootstrap: (...args: unknown[]) => unknown
  /** Provide to enable the realtime (WebSocket) branch of the sync engine. */
  connectRealtime?: (...args: unknown[]) => unknown
}

export function providersModule({
  push,
  pull,
  bootstrap,
  connectRealtime
}: BackendMocks) {
  return {
    isBackendConfigured: () => true,
    sync: {
      push: (...args: unknown[]) => push(...args),
      pull: (...args: unknown[]) => pull(...args),
      bootstrap: (...args: unknown[]) => bootstrap(...args),
      connectRealtime: connectRealtime
        ? (...args: unknown[]) => connectRealtime(...args)
        : undefined
    }
  }
}

export async function syncMediaModule(overrides: {
  uploadOwnedMedia: (...args: unknown[]) => unknown
  hydrateIncomingCardData: (...args: unknown[]) => unknown
}) {
  const actual =
    await vi.importActual<typeof import('@/lib/sync-media')>('@/lib/sync-media')
  return {
    ...actual,
    uploadOwnedMedia: (...args: unknown[]) =>
      overrides.uploadOwnedMedia(...args),
    hydrateIncomingCardData: (...args: unknown[]) =>
      overrides.hydrateIncomingCardData(...args)
  }
}

export function syncHttpClientModule() {
  return { httpSyncMediaApi: { planUploads: vi.fn(), planDownloads: vi.fn() } }
}

export function cardMediaStatsModule() {
  return {
    adjustCardMediaStats: vi.fn(),
    addEmbeddedMedia: vi.fn(),
    recordCardMediaDelete: vi.fn(),
    recordCardMediaUpsert: vi.fn(),
    sumEmbeddedCardMedia: vi.fn(() => ({ bytes: 0, images: 0, audio: 0 })),
    subEmbeddedMedia: vi.fn()
  }
}
