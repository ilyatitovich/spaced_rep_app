import { isAllowedOrigin } from './app.js'

it('allows configured web and extension origins only', () => {
  const allowed = ['https://app.example.com', 'chrome-extension://extension-id']
  expect(isAllowedOrigin('https://app.example.com', allowed)).toBe(true)
  expect(isAllowedOrigin('chrome-extension://extension-id', allowed)).toBe(true)
  expect(isAllowedOrigin('https://attacker.example', allowed)).toBe(false)
})

it('allows requests without an Origin header', () => {
  expect(isAllowedOrigin(undefined, [])).toBe(true)
})
