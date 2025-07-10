/**
 * Jest test environment setup
 * Configures global test utilities and mocks
 */

// Suppress console output during tests unless explicitly needed
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

// Clean up after tests
afterEach(() => {
    jest.clearAllTimers();
});

// Global test utilities
global.testUtils = {
    /**
     * Creates a promise that resolves after a specified delay
     */
    delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    
    /**
     * Waits for a condition to be true
     */
    waitFor: async (condition: () => boolean, timeout = 5000, interval = 100) => {
        const startTime = Date.now();
        while (!condition() && Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        if (!condition()) {
            throw new Error('Timeout waiting for condition');
        }
    },
    
    /**
     * Creates a mock function that returns a promise
     */
    mockAsync: <T>(returnValue?: T) => jest.fn().mockResolvedValue(returnValue),
    
    /**
     * Creates a mock function that throws an error
     */
    mockAsyncError: (error: Error | string) => 
        jest.fn().mockRejectedValue(typeof error === 'string' ? new Error(error) : error),
};

// Declare global test utilities for TypeScript
declare global {
    var testUtils: {
        delay: (ms: number) => Promise<void>;
        waitFor: (condition: () => boolean, timeout?: number, interval?: number) => Promise<void>;
        mockAsync: <T>(returnValue?: T) => jest.Mock<Promise<T>>;
        mockAsyncError: (error: Error | string) => jest.Mock<Promise<never>>;
    };
}

export {};