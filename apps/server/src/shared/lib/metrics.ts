const push = { sumMs: 0, count: 0 }
const pull = { sumSize: 0, count: 0 }
let wsConnections = 0

export function recordPushLatencyMs(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return
  push.sumMs += ms
  push.count += 1
}

export function recordPullPageSize(size: number): void {
  if (!Number.isFinite(size) || size < 0) return
  pull.sumSize += size
  pull.count += 1
}

export function setWsConnectionCount(count: number): void {
  wsConnections = Math.max(0, count)
}

export function resetMetricsForTests(): void {
  push.sumMs = 0
  push.count = 0
  pull.sumSize = 0
  pull.count = 0
  wsConnections = 0
}

/** Prometheus text exposition (no labels — single process). */
export function renderPrometheusMetrics(): string {
  const lines = [
    '# HELP sync_push_latency_ms Sync push handler wall time in milliseconds',
    '# TYPE sync_push_latency_ms summary',
    `sync_push_latency_ms_sum ${push.sumMs}`,
    `sync_push_latency_ms_count ${push.count}`,
    '# HELP sync_pull_page_size Records returned by a pull or bootstrap',
    '# TYPE sync_pull_page_size summary',
    `sync_pull_page_size_sum ${pull.sumSize}`,
    `sync_pull_page_size_count ${pull.count}`,
    '# HELP sync_ws_connections Open authenticated sync WebSocket connections',
    '# TYPE sync_ws_connections gauge',
    `sync_ws_connections ${wsConnections}`,
    ''
  ]
  return lines.join('\n')
}
