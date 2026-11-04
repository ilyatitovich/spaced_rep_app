#!/usr/bin/env node
/**
 * Baseline heap for a 5k-card in-memory deck (record shapes only).
 * Not an IndexedDB / browser profile — that stays a manual or Playwright follow-up.
 *
 * Usage: node --expose-gc testing/perf/deck-heap.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = join(root, 'testing/perf/baselines')
const outFile = join(outDir, 'deck-heap.json')
const committed = join(outDir, 'deck-heap.baseline.json')
const CARD_COUNT = 5000
/** Ceiling from first measured run + headroom; lower after real browser profiles. */
const HEAP_BUDGET_BYTES = 64 * 1024 * 1024

if (typeof global.gc === 'function') global.gc()
const before = process.memoryUsage().heapUsed

const now = Date.UTC(2026, 10, 4)
const cards = Array.from({ length: CARD_COUNT }, (_, i) => ({
  id: crypto.randomUUID(),
  topicId: crypto.randomUUID(),
  level: (i % 7) + 1,
  reviewDate: i % 3 === 0 ? null : now - (i % 10) * 86_400_000,
  updatedAt: new Date(now - i * 1000).toISOString(),
  dataJson: JSON.stringify({
    front: { blocks: [{ type: 'text', content: `Question ${i}` }] },
    back: { blocks: [{ type: 'text', content: `Answer ${i}` }] }
  }),
  deletedAt: null
}))

// Touch the deck so V8 cannot elide the allocation.
let checksum = 0
for (const card of cards) {
  checksum += card.level + card.dataJson.length
}

if (typeof global.gc === 'function') global.gc()
const after = process.memoryUsage().heapUsed

const report = {
  measuredAt: new Date().toISOString(),
  cardCount: CARD_COUNT,
  checksum,
  heapUsedBytes: after,
  heapDeltaBytes: after - before,
  budgetHeapUsedBytes: HEAP_BUDGET_BYTES,
  note: 'In-memory card records only; browser IDB heap is a separate measurement.'
}

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))

if (after > HEAP_BUDGET_BYTES) {
  console.error(
    `heapUsed ${after} > budget ${HEAP_BUDGET_BYTES}. Profile before raising.`
  )
  process.exit(1)
}

if (!existsSync(committed)) {
  writeFileSync(committed, `${JSON.stringify(report, null, 2)}\n`)
} else {
  const prev = JSON.parse(readFileSync(committed, 'utf8'))
  console.log(
    `delta vs committed baseline: ${after - (prev.heapUsedBytes ?? after)} bytes`
  )
}
