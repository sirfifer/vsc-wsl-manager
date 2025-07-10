"use strict";
/**
 * System command execution mocks
 * Provides mock implementations for child_process and file system operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandMockUtils = exports.testDataGenerators = exports.createPromisifyMock = exports.mockProcessEnv = exports.mockFs = exports.mockWSLListOutput = exports.mockSpawn = exports.mockExec = exports.MockChildProcess = void 0;
const events_1 = require("events");
/**
 * Mock child process for testing command execution
 */
class MockChildProcess extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.stdout = new events_1.EventEmitter();
        this.stderr = new events_1.EventEmitter();
        this.stdin = {
            write: jest.fn(),
            end: jest.fn()
        };
        this.pid = 12345;
        this.killed = false;
        this.exitCode = null;
    }
    kill(signal) {
        this.killed = true;
        this.emit('close', 0, signal);
        return true;
    }
    /**
     * Simulates successful command completion
     */
    simulateSuccess(output) {
        this.stdout.emit('data', Buffer.from(output));
        this.emit('close', 0, null);
        this.exitCode = 0;
    }
    /**
     * Simulates command failure
     */
    simulateError(error, code = 1) {
        this.stderr.emit('data', Buffer.from(error));
        this.emit('close', code, null);
        this.exitCode = code;
    }
}
exports.MockChildProcess = MockChildProcess;
/**
 * Mock implementation of exec for testing
 */
exports.mockExec = jest.fn((command, callback) => {
    const mockProcess = new MockChildProcess();
    if (callback) {
        // Simulate async execution
        process.nextTick(() => {
            if (command.includes('--list')) {
                callback(null, exports.mockWSLListOutput, '');
            }
            else if (command.includes('error')) {
                callback(new Error('Command failed'), '', 'Error output');
            }
            else {
                callback(null, 'Success', '');
            }
        });
    }
    return mockProcess;
});
/**
 * Mock implementation of spawn for testing
 */
exports.mockSpawn = jest.fn((command, args, options) => {
    const mockProcess = new MockChildProcess();
    // Simulate different command behaviors
    process.nextTick(() => {
        if (args.includes('--list') && args.includes('--verbose')) {
            mockProcess.simulateSuccess(exports.mockWSLListOutput);
        }
        else if (args.includes('--import')) {
            mockProcess.simulateSuccess('Import successful');
        }
        else if (args.includes('--export')) {
            mockProcess.simulateSuccess('Export successful');
        }
        else if (args.includes('error')) {
            mockProcess.simulateError('Command failed', 1);
        }
        else {
            mockProcess.simulateSuccess('Command completed');
        }
    });
    return mockProcess;
});
/**
 * Mock WSL list output for testing
 */
exports.mockWSLListOutput = `  NAME                   STATE           VERSION
* Ubuntu                 Running         2
  Debian                 Stopped         2
  Alpine                 Running         1`;
/**
 * Mock file system operations
 */
exports.mockFs = {
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        unlink: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockResolvedValue({
            isFile: () => true,
            isDirectory: () => false,
            size: 1024,
            mtime: new Date()
        }),
        readFile: jest.fn().mockResolvedValue(Buffer.from('file content')),
        writeFile: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined),
        readdir: jest.fn().mockResolvedValue(['file1.txt', 'file2.txt'])
    },
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('file content'),
    writeFileSync: jest.fn()
};
/**
 * Mock process environment
 */
exports.mockProcessEnv = {
    TEMP: '/tmp',
    USERPROFILE: 'C:\\Users\\TestUser',
    HOME: '/home/testuser',
    PATH: '/usr/bin:/bin'
};
/**
 * Creates a mock for promisify
 */
const createPromisifyMock = (implementation) => {
    return jest.fn(() => jest.fn((...args) => new Promise((resolve, reject) => {
        implementation(...args, (error, ...results) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(results.length === 1 ? results[0] : results);
            }
        });
    })));
};
exports.createPromisifyMock = createPromisifyMock;
/**
 * Test data generators
 */
exports.testDataGenerators = {
    /**
     * Generates a mock WSL distribution
     */
    createMockDistribution: (overrides) => ({
        name: 'TestDistribution',
        state: 'Running',
        version: '2',
        default: false,
        ...overrides
    }),
    /**
     * Generates mock distribution info
     */
    createMockDistributionInfo: (name, overrides) => ({
        name,
        kernel: '5.15.0-58-generic',
        os: 'Ubuntu 22.04.1 LTS',
        totalMemory: '16G',
        ...overrides
    }),
    /**
     * Generates a mock file path
     */
    createMockPath: (type = 'file') => {
        const extensions = { tar: '.tar', dir: '', file: '.txt' };
        return `/mock/path/test${extensions[type]}`;
    },
    /**
     * Generates mock command output
     */
    createMockCommandOutput: (lines) => lines.join('\n')
};
/**
 * Utilities for setting up command mocks
 */
exports.commandMockUtils = {
    /**
     * Sets up exec mock to return specific output for a command pattern
     */
    setupExecMock: (pattern, output, error) => {
        exports.mockExec.mockImplementation((command, callback) => {
            const matches = typeof pattern === 'string' ? command.includes(pattern) : pattern.test(command);
            if (matches && callback) {
                if (error) {
                    callback(new Error(error), '', error);
                }
                else {
                    callback(null, output, '');
                }
            }
            return new MockChildProcess();
        });
    },
    /**
     * Sets up spawn mock to return specific output for command arguments
     */
    setupSpawnMock: (command, argPattern, output, error) => {
        exports.mockSpawn.mockImplementation((cmd, args) => {
            const mockProcess = new MockChildProcess();
            if (cmd === command && argPattern.every(pattern => args.some(arg => arg.includes(pattern)))) {
                process.nextTick(() => {
                    if (error) {
                        mockProcess.simulateError(error);
                    }
                    else {
                        mockProcess.simulateSuccess(output);
                    }
                });
            }
            return mockProcess;
        });
    },
    /**
     * Resets all command mocks
     */
    resetAll: () => {
        exports.mockExec.mockClear();
        exports.mockSpawn.mockClear();
        exports.mockFs.promises.mkdir.mockClear();
        exports.mockFs.promises.unlink.mockClear();
        exports.mockFs.promises.stat.mockClear();
        exports.mockFs.promises.readFile.mockClear();
        exports.mockFs.promises.writeFile.mockClear();
    }
};
//# sourceMappingURL=systemCommands.js.map