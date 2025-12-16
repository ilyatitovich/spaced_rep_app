/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true
      }
    ]
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  }

  // setupFilesAfterEnv: ['./src/setupTests.js']
}
