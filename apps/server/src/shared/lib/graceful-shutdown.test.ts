import { describe, expect, it, vi } from 'vitest'

import { performGracefulShutdown } from './graceful-shutdown.js'

describe('performGracefulShutdown', () => {
  it('stops jobs, broadcasts, closes wss, then HTTP, then cleanup — in order', async () => {
    const order: string[] = []
    const wss = {
      close: vi.fn((cb?: (err?: Error) => void) => {
        order.push('wss')
        cb?.()
      })
    }

    await performGracefulShutdown({
      stopBackgroundJobs: async () => {
        order.push('jobs')
      },
      broadcastGracefulShutdown: reason => {
        order.push(`broadcast:${reason}`)
      },
      wss,
      closeHttp: async () => {
        order.push('http')
      },
      afterHttpClosed: async () => {
        order.push('cleanup')
      }
    })

    expect(order).toEqual([
      'jobs',
      'broadcast:server_restart',
      'wss',
      'http',
      'cleanup'
    ])
    expect(wss.close).toHaveBeenCalledOnce()
  })
})
