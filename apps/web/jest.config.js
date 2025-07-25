const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Jest configuration
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/$1'
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/index.ts',
    '!src/types/**/*',
    '!src/**/__tests__/**/*',
    '!src/**/node_modules/**/*'
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/lib/utils/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/lib/validation/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/lib/services/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/'
  ],
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$'
  ],
  // Test timeout for longer integration tests
  testTimeout: 30000,
  // Parallel execution settings
  maxWorkers: '50%',
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
}

// Create and export the Jest config
module.exports = createJestConfig(customJestConfig)