import AnkiImportWorker from './anki-import.worker?worker'
import type { Card } from '@/models/card.model'

type WorkerResponse =
  | { ok: true; cards: Card[] }
  | { ok: false; message: string }

/** Parse + map .apkg off the main thread; media buffers are transferred. */
export function runAnkiImportWorker(
  buffer: ArrayBuffer,
  topicId: string
): Promise<Card[]> {
  return new Promise((resolve, reject) => {
    const worker = new AnkiImportWorker()

    const fail = (error: unknown) => {
      worker.terminate()
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.cards)
      else reject(new Error(event.data.message))
    }
    worker.onerror = event => fail(event.error ?? new Error(event.message))
    worker.onmessageerror = () => fail(new Error('Anki import worker message error'))

    worker.postMessage({ buffer, topicId }, [buffer])
  })
}
