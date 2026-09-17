import { originsForAssertion } from './webauthn.service.js'

it('adds a chrome-extension origin', () => {
  expect(
    originsForAssertion(
      ['http://localhost:5173'],
      'chrome-extension://abc'
    )
  ).toEqual(['http://localhost:5173', 'chrome-extension://abc'])
})

it('ignores non-extension origins', () => {
  expect(
    originsForAssertion(['http://localhost:5173'], 'https://attacker.example')
  ).toEqual(['http://localhost:5173'])
})
