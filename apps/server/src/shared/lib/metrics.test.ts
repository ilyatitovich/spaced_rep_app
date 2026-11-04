import { beforeEach, describe, expect, it } from 'vitest'
import {
  recordPushLatencyMs,
  recordPullPageSize,
  renderPrometheusMetrics,
  resetMetricsForTests,
  setWsConnectionCount
} from './metrics.js'

describe('metrics', () => {
  beforeEach(() => {
    resetMetricsForTests()
  })

  it('exposes push latency, pull page size, and ws connections', () => {
    recordPushLatencyMs(10)
    recordPushLatencyMs(30)
    recordPullPageSize(5)
    recordPullPageSize(15)
    setWsConnectionCount(3)

    const text = renderPrometheusMetrics()

    expect(text).toContain('sync_push_latency_ms_sum 40')
    expect(text).toContain('sync_push_latency_ms_count 2')
    expect(text).toContain('sync_pull_page_size_sum 20')
    expect(text).toContain('sync_pull_page_size_count 2')
    expect(text).toContain('sync_ws_connections 3')
  })
})
