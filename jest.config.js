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
    // Force module mapping for lucide-react to its CJS build to resolve ESM import issues in Jest
    'lucide-react': '<rootDir>/node_modules/lucide-react/dist/cjs/lucide-react.js'
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(config)
