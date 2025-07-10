"use strict";
/**
 * Test data generators and utilities
 * Provides consistent test data for all test suites
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertionHelpers = exports.timingUtils = exports.responseGenerators = exports.errorGenerators = exports.inputGenerators = exports.pathGenerators = exports.distributionGenerators = void 0;
/**
 * Distribution test data generators
 */
exports.distributionGenerators = {
    /**
     * Creates a single WSL distribution with default or custom properties
     */
    createDistribution: (overrides) => ({
        name: 'Ubuntu',
        state: 'Running',
        version: '2',
        default: false,
        ...overrides
    }),
    /**
     * Creates an array of diverse distributions for testing
     */
    createDistributionList: () => [
        {
            name: 'Ubuntu',
            state: 'Running',
            version: '2',
            default: true
        },
        {
            name: 'Debian',
            state: 'Stopped',
            version: '2',
            default: false
        },
        {
            name: 'Alpine',
            state: 'Running',
            version: '1',
            default: false
        }
    ],
    /**
     * Creates raw WSL --list output for parsing tests
     */
    createRawWSLOutput: (distributions) => {
        const distros = distributions || exports.distributionGenerators.createDistributionList();
        const header = '  NAME                   STATE           VERSION\n';
        const rows = distros.map(d => `${d.default ? '*' : ' '} ${d.name.padEnd(22)} ${d.state.padEnd(15)} ${d.version}`).join('\n');
        return header + rows;
    }
};
/**
 * Path and file test data generators
 */
exports.pathGenerators = {
    /**
     * Creates platform-appropriate paths for testing
     */
    createPath: (type, platform = 'win') => {
        const bases = {
            win: 'C:\\Users\\TestUser',
            unix: '/home/testuser'
        };
        const paths = {
            tar: {
                win: `${bases.win}\\Downloads\\test-distro.tar`,
                unix: `${bases.unix}/downloads/test-distro.tar`
            },
            dir: {
                win: `${bases.win}\\WSL\\Distributions\\TestDistro`,
                unix: `${bases.unix}/wsl/distributions/test-distro`
            },
            config: {
                win: `${bases.win}\\AppData\\Roaming\\Code\\User\\settings.json`,
                unix: `${bases.unix}/.config/Code/User/settings.json`
            }
        };
        return paths[type][platform];
    },
    /**
     * Creates malicious path inputs for security testing
     */
    createMaliciousPath: (type) => {
        const maliciousPaths = {
            traversal: '../../../etc/passwd',
            injection: 'test.tar"; rm -rf /',
            unicode: 'test\u0000.tar'
        };
        return maliciousPaths[type];
    }
};
/**
 * Command and input test data generators
 */
exports.inputGenerators = {
    /**
     * Creates valid distribution names for testing
     */
    createValidDistributionName: () => [
        'ubuntu-dev',
        'test_env',
        'MyDistro123',
        'a',
        'a'.repeat(64) // Maximum length
    ],
    /**
     * Creates invalid distribution names for testing
     */
    createInvalidDistributionName: () => [
        { name: '', reason: 'empty' },
        { name: 'test@distro', reason: 'special character @' },
        { name: 'test distro', reason: 'space' },
        { name: 'test/distro', reason: 'forward slash' },
        { name: 'test\\distro', reason: 'backslash' },
        { name: 'test:distro', reason: 'colon' },
        { name: 'test"distro', reason: 'quote' },
        { name: 'test\'distro', reason: 'single quote' },
        { name: 'test;distro', reason: 'semicolon' },
        { name: 'test|distro', reason: 'pipe' },
        { name: 'test&distro', reason: 'ampersand' },
        { name: 'test>distro', reason: 'greater than' },
        { name: 'test<distro', reason: 'less than' },
        { name: 'a'.repeat(65), reason: 'too long' },
        { name: '../../etc', reason: 'path traversal' },
        { name: 'test\x00distro', reason: 'null byte' }
    ],
    /**
     * Creates command injection attempts for security testing
     */
    createCommandInjectionAttempts: () => [
        '"; echo "hacked',
        '\' && echo \'hacked',
        '`echo hacked`',
        '$(echo hacked)',
        'test || echo hacked',
        'test && echo hacked',
        'test; echo hacked',
        'test\necho hacked',
        'test\r\necho hacked'
    ]
};
/**
 * Error and edge case generators
 */
exports.errorGenerators = {
    /**
     * Creates various error scenarios
     */
    createError: (type) => {
        const errors = {
            'wsl-not-found': new Error('\'wsl.exe\' is not recognized as an internal or external command'),
            'permission': new Error('Access is denied'),
            'network': new Error('Network path not found'),
            'timeout': new Error('Operation timed out')
        };
        return errors[type];
    },
    /**
     * Creates process error scenarios
     */
    createProcessError: (code, signal) => ({
        code,
        signal,
        killed: signal !== undefined,
        cmd: 'wsl.exe --list'
    })
};
/**
 * Mock response generators
 */
exports.responseGenerators = {
    /**
     * Creates VS Code API responses
     */
    createVSCodeResponse: (type, value) => {
        const responses = {
            inputBox: value || 'user-input',
            quickPick: value || 'Ubuntu',
            dialog: value || [{ fsPath: '/path/to/file.tar' }]
        };
        return responses[type];
    },
    /**
     * Creates progress reporter mock
     */
    createProgressReporter: () => ({
        report: jest.fn(),
        increment: 0,
        message: ''
    }),
    /**
     * Creates cancellation token mock
     */
    createCancellationToken: (cancelled = false) => ({
        isCancellationRequested: cancelled,
        onCancellationRequested: jest.fn()
    })
};
/**
 * Timing and performance test utilities
 */
exports.timingUtils = {
    /**
     * Measures async operation time
     */
    measureTime: async (operation) => {
        const start = Date.now();
        const result = await operation();
        const time = Date.now() - start;
        return { result, time };
    },
    /**
     * Creates a delayed promise for testing timeouts
     */
    createDelayedPromise: (value, delay) => new Promise(resolve => setTimeout(() => resolve(value), delay)),
    /**
     * Creates a promise that never resolves for testing timeouts
     */
    createHangingPromise: () => new Promise(() => { }) // Never resolves
};
/**
 * Assertion helpers
 */
exports.assertionHelpers = {
    /**
     * Asserts that a promise rejects with specific error
     */
    assertRejects: async (promise, errorMessage) => {
        try {
            await promise;
            throw new Error('Expected promise to reject');
        }
        catch (error) {
            if (errorMessage) {
                if (typeof errorMessage === 'string') {
                    expect(error.message).toContain(errorMessage);
                }
                else {
                    expect(error.message).toMatch(errorMessage);
                }
            }
            return error;
        }
    },
    /**
     * Asserts that a function is called with specific arguments
     */
    assertCalledWith: (mockFn, ...expectedArgs) => {
        expect(mockFn).toHaveBeenCalled();
        const calls = mockFn.mock.calls;
        const found = calls.some(call => expectedArgs.every((arg, index) => {
            if (arg instanceof RegExp) {
                return arg.test(call[index]);
            }
            return call[index] === arg;
        }));
        expect(found).toBe(true);
    }
};
//# sourceMappingURL=testDataGenerators.js.map