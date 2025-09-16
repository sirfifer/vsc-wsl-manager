module.exports = {
  displayName: 'VSC WSL Manager - Unit Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file locations
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/test/unit/**/*.test.ts',
    '**/test/unit/**/*.spec.ts'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/test/**',
    '!src/extension.ts', // Tested via integration tests
    '!src/**/*.mock.ts'
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],
  
  // Coverage thresholds aligned with TDD approach
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Critical paths require higher coverage
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/security/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Module name mapping for cleaner imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^vscode$': '<rootDir>/test/mocks/vscode.mock.ts'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts'
  ],
  
  // Transform settings
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/dist/',
    '/.vscode-test/'
  ],
  
  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output for better debugging
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Bail on first test failure in CI
  bail: process.env.CI ? 1 : 0,
  
  // Max workers for parallel execution
  maxWorkers: process.env.CI ? 2 : '50%',
  
  // Globals for test environment
  globals: {
    'ts-jest': {
      diagnostics: {
        warnOnly: process.env.CI !== 'true'
      }
    }
  }
};
