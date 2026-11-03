import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface HeaderRule {
  source: string
  headers: { key: string; value: string }[]
}

const root = resolve(import.meta.dirname, '../..')

const config = JSON.parse(
  readFileSync(resolve(root, 'vercel.json'), 'utf8')
) as { headers?: HeaderRule[] }

function headersFor(source: string): Map<string, string> {
  const rule = config.headers?.find(r => r.source === source)
  expect(rule, `vercel.json has no headers rule for ${source}`).toBeDefined()
  return new Map(rule!.headers.map(h => [h.key.toLowerCase(), h.value]))
}

function csp(): Map<string, string[]> {
  const value = headersFor('/(.*)').get('content-security-policy')
  expect(value, 'Content-Security-Policy header is missing').toBeDefined()
  return new Map(
    value!
      .split(';')
      .map(part => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name!, sources])
  )
}

describe('vercel.json security headers', () => {
  it('sets the baseline hardening headers on every route', () => {
    const headers = headersFor('/(.*)')

    expect(headers.get('strict-transport-security')).toMatch(/max-age=\d{8,}/)
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin'
    )
    expect(headers.get('permissions-policy')).toContain('camera=()')
  })

  it('never allows inline or eval script execution', () => {
    const scriptSrc = csp().get('script-src') ?? []

    expect(scriptSrc).toContain("'self'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    expect(scriptSrc.filter(s => s === '*' || s === 'https:')).toEqual([])
  })

  it('locks down plugins, framing and base URI', () => {
    const directives = csp()

    expect(directives.get('default-src')).toEqual(["'self'"])
    expect(directives.get('object-src')).toEqual(["'none'"])
    expect(directives.get('base-uri')).toEqual(["'self'"])
    expect(directives.get('frame-ancestors')).toEqual(["'none'"])
    expect(directives.get('form-action')).toEqual(["'self'"])
  })

  it('allows the third parties the client actually uses', () => {
    const directives = csp()

    expect(directives.get('script-src')).toContain(
      'https://challenges.cloudflare.com'
    )
    expect(directives.get('frame-src')).toContain(
      'https://challenges.cloudflare.com'
    )
    // Sentry, the API (WebSocket included) and presigned R2 URLs are all fetched.
    expect(directives.get('connect-src')).toEqual(
      expect.arrayContaining(["'self'", 'https:', 'wss:'])
    )
    // Imported cards render blob: media and remote images.
    expect(directives.get('img-src')).toEqual(
      expect.arrayContaining(["'self'", 'blob:', 'data:', 'https:'])
    )
    expect(directives.get('worker-src')).toEqual(
      expect.arrayContaining(["'self'", 'blob:'])
    )
  })

  it.each(['/sw.js', '/index.html', '/manifest.webmanifest'])(
    'revalidates %s on every load so a deploy reaches users',
    source => {
      expect(headersFor(source).get('cache-control')).toMatch(/no-cache/)
    }
  )

  it('caches fingerprinted assets forever', () => {
    expect(headersFor('/assets/(.*)').get('cache-control')).toBe(
      'public, max-age=31536000, immutable'
    )
  })

  it('does not ship a Netlify-style _headers file that Vercel ignores', () => {
    expect(existsSync(resolve(root, 'apps/client/public/_headers'))).toBe(false)
  })
})
