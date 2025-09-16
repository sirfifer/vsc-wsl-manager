import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', '.vscode-test', 'out'],
    coverage: {
      provider: 'c8',
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
    mockReset: true,
    clearMocks: true,
    restoreMocks: true
  },
  resolve: {
    alias: {
      'vscode': path.resolve(__dirname, './test/mocks/vscode.ts'),
      '@': path.resolve(__dirname, './src')
    }
  },
  esbuild: {
    target: 'node18'
  }
});