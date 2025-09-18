/**
 * ErrorHandler Real Tests
 * Tests actual error handling and classification
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect } from 'vitest';
import { ErrorHandler, WSLError, ErrorType } from '../../../src/errors/errorHandler';
import { spawn } from 'child_process';

describe('ErrorHandler - Real Error Handling', () => {
    describe('Error Classification', () => {
        it('should classify WSL not installed errors', () => {
            const errors = [
                new Error("'wsl' is not recognized as an internal or external command"),
                new Error("wsl: command not found"),
                new Error("The term 'wsl' is not recognized"),
                new Error("wsl.exe: No such file or directory")
            ];

            for (const error of errors) {
                const type = ErrorHandler.determineErrorType(error);
                expect(type).toBe(ErrorType.WSL_NOT_INSTALLED);
            }
        });

        it('should classify distribution not found errors', () => {
            const errors = [
                new Error("There is no distribution with the supplied name"),
                new Error("Distribution 'TestDistro' not found"),
                new Error("The specified distribution does not exist"),
                new Error("No such distribution: Ubuntu-Test")
            ];

            for (const error of errors) {
                const type = ErrorHandler.determineErrorType(error);
                expect(type).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            }
        });

        it('should classify permission errors', () => {
            const errors = [
                new Error("Access is denied"),
                new Error("Permission denied"),
                new Error("Insufficient privileges"),
                new Error("Operation requires elevation"),
                new Error("EACCES: permission denied")
            ];

            for (const error of errors) {
                const type = ErrorHandler.determineErrorType(error);
                expect(type).toBe(ErrorType.PERMISSION_DENIED);
            }
        });

        it('should classify file not found errors', () => {
            const errors = [
                new Error("The system cannot find the file specified"),
                new Error("No such file or directory"),
                new Error("ENOENT: no such file"),
                new Error("File not found: /tmp/test.tar")
            ];

            for (const error of errors) {
                const type = ErrorHandler.determineErrorType(error);
                expect(type).toBe(ErrorType.FILE_NOT_FOUND);
            }
        });

        it('should classify invalid operation errors', () => {
            const errors = [
                new Error("The distribution is already running"),
                new Error("Cannot delete running distribution"),
                new Error("Distribution is in use"),
                new Error("Operation not valid in current state")
            ];

            for (const error of errors) {
                const type = ErrorHandler.determineErrorType(error);
                expect(type).toBe(ErrorType.INVALID_OPERATION);
            }
        });

        it('should classify network errors', () => {
            const errors = [
                new Error("Network is unreachable"),
                new Error("Connection timed out"),
                new Error("ETIMEDOUT"),
                new Error("Failed to download"),
                new Error("HTTP 404: Not Found"),
                new Error("ECONNREFUSED")
            ];

            for (const error of errors) {
                const type = ErrorHandler.determineErrorType(error);
                expect(type).toBe(ErrorType.NETWORK_ERROR);
            }
        });
    });

    describe('WSLError Creation', () => {
        it('should create WSLError with all properties', () => {
            const error = new WSLError(
                ErrorType.DISTRIBUTION_NOT_FOUND,
                'Distribution not found',
                'The distribution "Test" does not exist',
                ['Check available distributions', 'Create new distribution']
            );

            expect(error.type).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            expect(error.message).toBe('Distribution not found');
            expect(error.details).toBe('The distribution "Test" does not exist');
            expect(error.suggestions).toHaveLength(2);
            expect(error.name).toBe('WSLError');
        });

        it('should include stack trace', () => {
            const error = new WSLError(
                ErrorType.UNKNOWN,
                'Test error'
            );

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('WSLError');
        });
    });

    describe('Error Message Generation', () => {
        it('should generate user-friendly messages', () => {
            const error = new Error("wsl: command not found");
            const message = ErrorHandler.getUserMessage(error);

            expect(message).not.toContain('undefined');
            expect(message).not.toContain('null');
            expect(message).toContain('WSL');
        });

        it('should provide recovery suggestions', () => {
            const testCases = [
                {
                    error: new Error("'wsl' is not recognized"),
                    expectedSuggestion: /install.*wsl/i
                },
                {
                    error: new Error("Access is denied"),
                    expectedSuggestion: /administrator|elevation|permission/i
                },
                {
                    error: new Error("The distribution is already running"),
                    expectedSuggestion: /terminate|stop/i
                }
            ];

            for (const { error, expectedSuggestion } of testCases) {
                const suggestions = ErrorHandler.getRecoverySuggestions(error);
                expect(suggestions.some(s => expectedSuggestion.test(s))).toBe(true);
            }
        });
    });

    describe('Timeout Handling', () => {
        it('should handle operation timeout', async () => {
            const slowOperation = () => new Promise(resolve => {
                setTimeout(resolve, 1000);
            });

            try {
                await ErrorHandler.withTimeout(
                    slowOperation(),
                    100,  // 100ms timeout
                    'test operation'
                );
                expect.fail('Should have timed out');
            } catch (error: any) {
                expect(error.message).toContain('timed out');
                expect(error.message).toContain('test operation');
            }
        });

        it('should complete fast operations', async () => {
            const fastOperation = () => Promise.resolve('success');

            const result = await ErrorHandler.withTimeout(
                fastOperation(),
                1000,
                'fast operation'
            );

            expect(result).toBe('success');
        });

        it('should preserve error details on timeout', async () => {
            const operationName = 'Import distribution';

            try {
                await ErrorHandler.withTimeout(
                    new Promise(() => {}), // Never resolves
                    100,
                    operationName
                );
            } catch (error: any) {
                expect(error.message).toContain(operationName);
                expect(error.name).toBe('TimeoutError');
            }
        });
    });

    describe('Real WSL Error Scenarios', () => {
        it('should handle real WSL command errors', async () => {
            // Try to unregister non-existent distribution
            const result = await new Promise<{error?: Error}>((resolve) => {
                const process = spawn('wsl.exe', ['--unregister', 'NonExistentDistro123456']);

                let stderr = '';
                process.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                process.on('close', (code) => {
                    if (code !== 0) {
                        resolve({ error: new Error(stderr) });
                    } else {
                        resolve({});
                    }
                });

                process.on('error', (err) => {
                    resolve({ error: err });
                });
            });

            if (result.error) {
                const type = ErrorHandler.determineErrorType(result.error);
                // Should classify correctly
                expect([
                    ErrorType.DISTRIBUTION_NOT_FOUND,
                    ErrorType.WSL_NOT_INSTALLED
                ]).toContain(type);
            }
        });

        it('should handle file system errors', () => {
            const fsErrors = [
                { code: 'ENOENT', message: 'File not found' },
                { code: 'EACCES', message: 'Permission denied' },
                { code: 'EEXIST', message: 'File already exists' },
                { code: 'EISDIR', message: 'Is a directory' },
                { code: 'ENOTDIR', message: 'Not a directory' },
                { code: 'EMFILE', message: 'Too many open files' }
            ];

            for (const { code, message } of fsErrors) {
                const error: any = new Error(message);
                error.code = code;

                const type = ErrorHandler.determineErrorType(error);
                expect(type).not.toBe(ErrorType.UNKNOWN);
            }
        });
    });

    describe('Error Context Enhancement', () => {
        it('should add context to errors', () => {
            const originalError = new Error('File not found');
            const enhanced = ErrorHandler.enhanceError(
                originalError,
                'Importing distribution',
                { distributionName: 'Ubuntu', tarPath: '/tmp/ubuntu.tar' }
            );

            expect(enhanced.message).toContain('Importing distribution');
            expect(enhanced.context).toBeDefined();
            expect(enhanced.context.distributionName).toBe('Ubuntu');
            expect(enhanced.context.tarPath).toBe('/tmp/ubuntu.tar');
        });

        it('should preserve original error information', () => {
            const originalError = new Error('Original message');
            originalError.stack = 'Original stack trace';

            const enhanced = ErrorHandler.enhanceError(
                originalError,
                'Additional context'
            );

            expect(enhanced.originalError).toBe(originalError);
            expect(enhanced.originalMessage).toBe('Original message');
            expect(enhanced.stack).toContain('Original stack trace');
        });
    });

    describe('Error Formatting', () => {
        it('should format errors for display', () => {
            const error = new WSLError(
                ErrorType.PERMISSION_DENIED,
                'Cannot access file',
                'Permission denied when accessing /etc/shadow',
                ['Run as administrator', 'Check file permissions']
            );

            const formatted = ErrorHandler.formatForDisplay(error);

            expect(formatted).toContain('Cannot access file');
            expect(formatted).toContain('Permission denied');
            expect(formatted).toContain('Run as administrator');
            expect(formatted).not.toContain('undefined');
        });

        it('should handle errors without suggestions', () => {
            const error = new WSLError(
                ErrorType.UNKNOWN,
                'Unknown error occurred'
            );

            const formatted = ErrorHandler.formatForDisplay(error);

            expect(formatted).toContain('Unknown error occurred');
            expect(formatted).not.toContain('undefined');
        });
    });

    describe('Error Logging', () => {
        it('should prepare errors for logging', () => {
            const error = new Error('Test error');
            error.stack = 'Test stack trace';

            const logData = ErrorHandler.prepareForLogging(error);

            expect(logData).toHaveProperty('message');
            expect(logData).toHaveProperty('stack');
            expect(logData).toHaveProperty('timestamp');
            expect(logData).toHaveProperty('type');
        });

        it('should sanitize sensitive information', () => {
            const error = new Error('Failed to access C:\\Users\\JohnDoe\\secret.txt');

            const logData = ErrorHandler.prepareForLogging(error);

            // Should mask sensitive paths
            expect(logData.message).not.toContain('JohnDoe');
            expect(logData.message).toContain('***');
        });
    });

    describe('Error Recovery', () => {
        it('should suggest recovery actions', () => {
            const scenarios = [
                {
                    error: ErrorType.WSL_NOT_INSTALLED,
                    expectedAction: 'install'
                },
                {
                    error: ErrorType.PERMISSION_DENIED,
                    expectedAction: 'admin'
                },
                {
                    error: ErrorType.DISTRIBUTION_NOT_FOUND,
                    expectedAction: 'create'
                },
                {
                    error: ErrorType.FILE_NOT_FOUND,
                    expectedAction: 'check'
                }
            ];

            for (const { error, expectedAction } of scenarios) {
                const suggestions = ErrorHandler.getRecoveryActionsForType(error);
                expect(suggestions.some(s =>
                    s.toLowerCase().includes(expectedAction)
                )).toBe(true);
            }
        });
    });
});