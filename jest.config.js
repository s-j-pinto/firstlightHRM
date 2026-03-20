const nextJest = require('next/jest')

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.mjs and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // This is the key fix. It tells Jest to transform lucide-react, which is an ESM module.
  transformIgnorePatterns: [
    '/node_modules/(?!lucide-react)/'
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(config)
