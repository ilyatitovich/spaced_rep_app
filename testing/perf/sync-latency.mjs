#!/usr/bin/env node
/**
 * CPU-side sync lag proxy: JSON round-trip of a push-sized mutation batch.
 * Live HTTP push/pull RTT is optional via PERF_SYNC_URL (nightly when API is up).
 *
 * Writes testing/perf/baselines/sync-latency.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = join(root, 'testing/perf/baselines')
const BATCH = 50
const ITERATIONS = 1000
/** Mean batch round-trip µs; measured ceiling with headroom. */
const MEAN_US_BUDGET = 2_000

const id = () => crypto.randomUUID()
const mutation = () => ({
  opId: id(),
  deviceId: id(),
  table: 'cards',
  recordId: id(),
  operation: 'upsert',
  updatedAt: 1,
  card: {
    id: id(),
    topicId: id(),
    level: 0,
    dataJson: '{"front":{"blocks":[]},"back":{"blocks":[]}}',
    updatedAt: 1
  }
})

const batch = { mutations: Array.from({ length: BATCH }, mutation) }

const start = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  JSON.parse(JSON.stringify(batch))
}
const elapsedMs = performance.now() - start
const meanUs = (elapsedMs * 1000) / ITERATIONS

const report = {
  measuredAt: new Date().toISOString(),
  batchSize: BATCH,
  iterations: ITERATIONS,
  elapsedMs,
  meanUs,
  budgetMeanUs: MEAN_US_BUDGET,
  note: 'JSON batch round-trip only. Set PERF_SYNC_URL for HTTP RTT on nightly.'
}

if (process.env.PERF_SYNC_URL) {
  const url = process.env.PERF_SYNC_URL.replace(/\/$/, '')
  const t0 = performance.now()
  const res = await fetch(`${url}/live`)
  const rttMs = performance.now() - t0
  report.httpLiveRttMs = rttMs
  report.httpLiveOk = res.ok
}

mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'sync-latency.json'),
  `${JSON.stringify(report, null, 2)}\n`
)
console.log(JSON.stringify(report, null, 2))

if (meanUs > MEAN_US_BUDGET) {
  console.error(`mean ${meanUs.toFixed(1)}µs > budget ${MEAN_US_BUDGET}µs`)
  process.exit(1)
}
