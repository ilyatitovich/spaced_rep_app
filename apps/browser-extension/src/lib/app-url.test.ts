import { isAppUrl } from './app-url'

it('treats the web app origin as the app', () => {
  expect(isAppUrl('http://localhost:5173/settings?subscription=true')).toBe(
    true
  )
})

it('allows capturing other http pages', () => {
  expect(isAppUrl('https://example.com/article')).toBe(false)
  expect(isAppUrl('chrome://extensions')).toBe(false)
  expect(isAppUrl(undefined)).toBe(false)
})
