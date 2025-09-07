/**
 * System command execution mocks
 * Provides mock implementations for child_process and file system operations
 */

import { EventEmitter } from 'events';

/**
 * Mock child process for testing command execution
 */
export class MockChildProcess extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    stdin = {
        write: jest.fn(),
        end: jest.fn()
    };
    
    pid = 12345;
    killed = false;
    exitCode: number | null = null;
    
    kill(signal?: string): boolean {
        this.killed = true;
        this.emit('close', 0, signal);
        return true;
    }
    
    /**
     * Simulates successful command completion
     */
    simulateSuccess(output: string): void {
        this.stdout.emit('data', Buffer.from(output));
        this.emit('close', 0, null);
        this.exitCode = 0;
    }
    
    /**
     * Simulates command failure
     */
    simulateError(error: string, code = 1): void {
        this.stderr.emit('data', Buffer.from(error));
        this.emit('close', code, null);
        this.exitCode = code;
    }
}

/**
 * Mock implementation of exec for testing
 */
export const mockExec = jest.fn((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    const mockProcess = new MockChildProcess();
    
    if (callback) {
        // Simulate async execution
        process.nextTick(() => {
            if (command.includes('--list')) {
                callback(null, mockWSLListOutput, '');
            } else if (command.includes('error')) {
                callback(new Error('Command failed'), '', 'Error output');
            } else {
                callback(null, 'Success', '');
            }
        });
    }
    
    return mockProcess;
});

/**
 * Mock implementation of spawn for testing
 */
export const mockSpawn = jest.fn((command: string, args: string[], options?: any) => {
    const mockProcess = new MockChildProcess();
    
    // Simulate different command behaviors
    process.nextTick(() => {
        if (args.includes('--list') && args.includes('--verbose')) {
            mockProcess.simulateSuccess(mockWSLListOutput);
        } else if (args.includes('--import')) {
            mockProcess.simulateSuccess('Import successful');
        } else if (args.includes('--export')) {
            mockProcess.simulateSuccess('Export successful');
        } else if (args.includes('error')) {
            mockProcess.simulateError('Command failed', 1);
        } else {
            mockProcess.simulateSuccess('Command completed');
        }
    });
    
    return mockProcess;
});

/**
 * Mock WSL list output for testing
 */
export const mockWSLListOutput = `  NAME                   STATE           VERSION
* Ubuntu                 Running         2
  Debian                 Stopped         2
  Alpine                 Running         1`;

/**
 * Mock file system operations
 */
export const mockFs = {
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
export const mockProcessEnv = {
    TEMP: '/tmp',
    USERPROFILE: 'C:\\Users\\TestUser',
    HOME: '/home/testuser',
    PATH: '/usr/bin:/bin'
};

/**
 * Creates a mock for promisify
 */
export const createPromisifyMock = (implementation: Function) => {
    return jest.fn(() => jest.fn((...args: any[]) => 
        new Promise((resolve, reject) => {
            implementation(...args, (error: Error | null, ...results: any[]) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results.length === 1 ? results[0] : results);
                }
            });
        })
    ));
};

/**
 * Test data generators
 */
export const testDataGenerators = {
    /**
     * Generates a mock WSL distribution
     */
    createMockDistribution: (overrides?: Partial<any>) => ({
        name: 'TestDistribution',
        state: 'Running',
        version: '2',
        default: false,
        ...overrides
    }),
    
    /**
     * Generates mock distribution info
     */
    createMockDistributionInfo: (name: string, overrides?: Partial<any>) => ({
        name,
        kernel: '5.15.0-58-generic',
        os: 'Ubuntu 22.04.1 LTS',
        totalMemory: '16G',
        ...overrides
    }),
    
    /**
     * Generates a mock file path
     */
    createMockPath: (type: 'tar' | 'dir' | 'file' = 'file') => {
        const extensions = { tar: '.tar', dir: '', file: '.txt' };
        return `/mock/path/test${extensions[type]}`;
    },
    
    /**
     * Generates mock command output
     */
    createMockCommandOutput: (lines: string[]) => lines.join('\n')
};

/**
 * Utilities for setting up command mocks
 */
export const commandMockUtils = {
    /**
     * Sets up exec mock to return specific output for a command pattern
     */
    setupExecMock: (pattern: string | RegExp, output: string, error?: string) => {
        mockExec.mockImplementation((command, callback) => {
            const matches = typeof pattern === 'string' ? command.includes(pattern) : pattern.test(command);
            if (matches && callback) {
                if (error) {
                    callback(new Error(error), '', error);
                } else {
                    callback(null, output, '');
                }
            }
            return new MockChildProcess();
        });
    },
    
    /**
     * Sets up spawn mock to return specific output for command arguments
     */
    setupSpawnMock: (command: string, argPattern: string[], output: string, error?: string) => {
        mockSpawn.mockImplementation((cmd, args) => {
            const mockProcess = new MockChildProcess();
            
            if (cmd === command && argPattern.every(pattern => args.some(arg => arg.includes(pattern)))) {
                process.nextTick(() => {
                    if (error) {
                        mockProcess.simulateError(error);
                    } else {
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
        mockExec.mockClear();
        mockSpawn.mockClear();
        mockFs.promises.mkdir.mockClear();
        mockFs.promises.unlink.mockClear();
        mockFs.promises.stat.mockClear();
        mockFs.promises.readFile.mockClear();
        mockFs.promises.writeFile.mockClear();
    }
};

// Export mocks for direct use in tests
export { mockExec, mockSpawn, mockFs, mockProcessEnv };