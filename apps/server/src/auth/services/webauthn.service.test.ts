import { originsForAssertion } from './webauthn.service.js'

const configured = ['http://localhost:5173']
const allowlist = ['http://localhost:5173', 'chrome-extension://abc']

it('adds an allowlisted chrome-extension origin', () => {
  expect(
    originsForAssertion(configured, 'chrome-extension://abc', allowlist)
  ).toEqual(['http://localhost:5173', 'chrome-extension://abc'])
})

it('does not add a chrome-extension origin outside the allowlist', () => {
  expect(
    originsForAssertion(configured, 'chrome-extension://evil', allowlist)
  ).toEqual(configured)
})

it('ignores non-extension origins', () => {
  expect(
    originsForAssertion(configured, 'https://attacker.example', allowlist)
  ).toEqual(configured)
})
