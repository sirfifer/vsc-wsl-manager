/**
 * Test Setup File
 * Configures the test environment before running tests
 */

import '@testing-library/jest-dom';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.VSCODE_TEST = 'true';

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress expected error messages
  console.error = jest.fn((message, ...args) => {
    // Only show unexpected errors
    if (!message?.includes('Expected test error')) {
      originalConsoleError(message, ...args);
    }
  });
  
  console.warn = jest.fn((message, ...args) => {
    // Only show important warnings
    if (!message?.includes('Test warning')) {
      originalConsoleWarn(message, ...args);
    }
  });
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for a condition to be true
   */
  async waitFor(condition: () => boolean | Promise<boolean>, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },
  
  /**
   * Create a mock VS Code ExtensionContext
   */
  createMockContext(): any {
    return {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn(() => [])
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn(() => []),
        setKeysForSync: jest.fn()
      },
      extensionPath: '/mock/extension/path',
      extensionUri: {
        fsPath: '/mock/extension/path',
        path: '/mock/extension/path',
        scheme: 'file'
      },
      environmentVariableCollection: {
        append: jest.fn(),
        clear: jest.fn(),
        delete: jest.fn(),
        forEach: jest.fn(),
        get: jest.fn(),
        prepend: jest.fn(),
        replace: jest.fn()
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: jest.fn()
      },
      storageUri: {
        fsPath: '/mock/storage/path',
        path: '/mock/storage/path',
        scheme: 'file'
      },
      globalStorageUri: {
        fsPath: '/mock/global/storage/path',
        path: '/mock/global/storage/path',
        scheme: 'file'
      },
      logUri: {
        fsPath: '/mock/log/path',
        path: '/mock/log/path',
        scheme: 'file'
      },
      extensionMode: 2, // ExtensionMode.Test
      extension: {
        id: 'vsc-wsl-manager',
        extensionUri: {
          fsPath: '/mock/extension/path',
          path: '/mock/extension/path',
          scheme: 'file'
        },
        extensionPath: '/mock/extension/path',
        isActive: true,
        packageJSON: {
          name: 'vsc-wsl-manager',
          version: '0.1.0'
        },
        exports: {},
        activate: jest.fn(),
        extensionKind: 1
      },
      asAbsolutePath: jest.fn(relativePath => `/mock/extension/path/${relativePath}`)
    };
  },
  
  /**
   * Create a mock WSL distribution
   */
  createMockDistribution(overrides = {}) {
    return {
      name: 'Ubuntu-22.04',
      state: 'Running',
      version: 2,
      isDefault: false,
      ...overrides
    };
  },
  
  /**
   * Simulate async delay
   */
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Custom Jest matchers
expect.extend({
  /**
   * Check if a value is a valid WSL distribution name
   */
  toBeValidDistributionName(received: string) {
    const validNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/;
    const pass = validNameRegex.test(received) && 
                 received.length <= 255 &&
                 !received.includes('..') &&
                 !received.startsWith('-');
    
    return {
      pass,
      message: () => 
        pass 
          ? `expected ${received} not to be a valid distribution name`
          : `expected ${received} to be a valid distribution name`
    };
  },
  
  /**
   * Check if a command is safe (no injection)
   */
  toBeSafeCommand(received: string) {
    const dangerousPatterns = [
      /[;&|`$()]/,  // Command separators and substitutions
      /\.\./,       // Directory traversal
      /[<>]/,       // Redirections
      /[\r\n]/      // Line breaks
    ];
    
    const pass = !dangerousPatterns.some(pattern => pattern.test(received));
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a safe command`
          : `expected ${received} to be a safe command (contains dangerous characters)`
    };
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDistributionName(): R;
      toBeSafeCommand(): R;
    }
  }
  
  var testUtils: {
    waitFor(condition: () => boolean | Promise<boolean>, timeout?: number): Promise<void>;
    createMockContext(): any;
    createMockDistribution(overrides?: any): any;
    delay(ms: number): Promise<void>;
  };
}

export {};
