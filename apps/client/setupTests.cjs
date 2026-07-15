require('@testing-library/jest-dom')

const { webcrypto } = require('node:crypto')

// jsdom does not always expose the Web Crypto API our models rely on.
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = webcrypto.randomUUID.bind(webcrypto)
}
