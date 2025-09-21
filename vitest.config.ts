import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.real.test.ts'],
    exclude: ['node_modules', '.vscode-test', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      exclude: [
        'node_modules/',
        'test/',
        'out/',
        'scripts/',
        'docs/',
        '*.config.ts',
        '*.config.js'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    threads: false, // Disable threads for better debugging
    // NO MOCK CONFIGURATION - Real testing only
    mockReset: false,
    clearMocks: false,
    restoreMocks: false
  },
  resolve: {
    alias: {
      // NO MOCK ALIASES - Direct imports only for real testing
      // VS Code API mocking removed - use @vscode/test-electron for Level 2 tests
      '@': path.resolve(__dirname, './src')
    }
  },
  esbuild: {
    target: 'node18'
  }
});