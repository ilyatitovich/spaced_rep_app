import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'

// jsdom does not always expose the Web Crypto API our models rely on.
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = webcrypto.randomUUID.bind(webcrypto)
}
