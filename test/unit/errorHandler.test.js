"use strict";
/**
 * Unit tests for ErrorHandler module
 * Tests error classification, user-friendly messages, and recovery actions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const errorHandler_1 = require("../../src/errors/errorHandler");
const vscode = __importStar(require("vscode"));
// Mock vscode
jest.mock('vscode');
describe('ErrorHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock vscode methods
        vscode.window.showErrorMessage.mockResolvedValue(undefined);
        vscode.window.showInformationMessage.mockResolvedValue(undefined);
        vscode.env.openExternal.mockResolvedValue(true);
        vscode.window.createTerminal.mockReturnValue({
            show: jest.fn(),
            sendText: jest.fn()
        });
    });
    describe('determineErrorType', () => {
        it('should identify WSL not installed errors', () => {
            const errors = [
                { message: 'wsl.exe not found' },
                { message: 'The system cannot find wsl.exe' },
                new Error('Cannot find wsl.exe in PATH')
            ];
            errors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.WSL_NOT_INSTALLED);
            });
        });
        it('should identify distribution not found errors', () => {
            const errors = [
                { message: 'Distribution "Ubuntu" not found' },
                { message: 'The specified distribution was not found' },
                new Error('Distribution test-distro not found')
            ];
            errors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.DISTRIBUTION_NOT_FOUND);
            });
        });
        it('should identify permission errors', () => {
            const errors = [
                { message: 'Permission denied', code: 'EACCES' },
                { message: 'Access denied to file' },
                new Error('EACCES: permission denied')
            ];
            errors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.PERMISSION_DENIED);
            });
        });
        it('should identify file not found errors', () => {
            const errors = [
                { code: 'ENOENT' },
                { message: 'ENOENT: no such file or directory' },
                new Error('File not found: /path/to/file')
            ];
            errors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.FILE_NOT_FOUND);
            });
        });
        it('should identify network errors', () => {
            const errors = [
                { message: 'network error occurred' },
                { message: 'Failed to download package' },
                { code: 'ENETUNREACH' }
            ];
            errors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.NETWORK_ERROR);
            });
        });
        it('should identify rate limit errors', () => {
            const error = new Error('Rate limit exceeded for import operations');
            expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.RATE_LIMIT_EXCEEDED);
        });
        it('should identify security violations', () => {
            const error = new Error('Security validation failed: dangerous command detected');
            expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.SECURITY_VIOLATION);
        });
        it('should identify timeout errors', () => {
            const errors = [
                { message: 'Operation timed out' },
                { message: 'Command timeout after 30s' },
                new Error('Request timeout')
            ];
            errors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.TIMEOUT);
            });
        });
        it('should identify invalid input errors', () => {
            const error = new Error('Invalid distribution name: contains illegal characters');
            expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.INVALID_INPUT);
        });
        it('should identify command failures', () => {
            const errors = [
                { message: 'Command failed with exit code 1' },
                new Error('WSL command failed: non-zero exit')
            ];
            errors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.COMMAND_FAILED);
            });
        });
        it('should return UNKNOWN for unrecognized errors', () => {
            const error = new Error('Some random error');
            expect(errorHandler_1.ErrorHandler.determineErrorType(error)).toBe(errorHandler_1.ErrorType.UNKNOWN);
        });
    });
    describe('createError', () => {
        it('should create WSLError with proper properties', () => {
            const originalError = new Error('Distribution "test" not found');
            const wslError = errorHandler_1.ErrorHandler.createError(originalError);
            expect(wslError).toBeInstanceOf(errorHandler_1.WSLError);
            expect(wslError.type).toBe(errorHandler_1.ErrorType.DISTRIBUTION_NOT_FOUND);
            expect(wslError.message).toBe('Distribution Not Found');
            expect(wslError.details).toContain('Distribution "test" not found');
            expect(wslError.recoveryActions).toBeDefined();
            expect(wslError.recoveryActions?.length).toBeGreaterThan(0);
        });
        it('should handle errors with stderr', () => {
            const error = {
                message: 'Command failed',
                stderr: 'wsl: Distribution not found'
            };
            const wslError = errorHandler_1.ErrorHandler.createError(error);
            expect(wslError.details).toBe('wsl: Distribution not found');
        });
        it('should handle string errors', () => {
            const wslError = errorHandler_1.ErrorHandler.createError('Permission denied');
            expect(wslError.type).toBe(errorHandler_1.ErrorType.PERMISSION_DENIED);
        });
    });
    describe('showError', () => {
        it('should show error message with operation context', async () => {
            const error = new Error('File not found');
            await errorHandler_1.ErrorHandler.showError(error, 'import distribution');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to import distribution'), expect.any(String), expect.any(String), expect.any(String));
        });
        it('should show recovery actions when available', async () => {
            const error = new Error('wsl.exe not found');
            await errorHandler_1.ErrorHandler.showError(error);
            const call = vscode.window.showErrorMessage.mock.calls[0];
            expect(call[0]).toContain('WSL Not Installed');
            expect(call.slice(1)).toContain('Show Details');
        });
        it('should show detailed error when requested', async () => {
            vscode.window.showErrorMessage.mockResolvedValue('Show Details');
            const error = new Error('Network error');
            await errorHandler_1.ErrorHandler.showError(error);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('Error Type:'), { modal: true });
        });
        it('should execute recovery action when selected', async () => {
            vscode.window.showErrorMessage.mockResolvedValue('Run "wsl --list" to see available distributions');
            const error = new Error('Distribution not found');
            await errorHandler_1.ErrorHandler.showError(error);
            expect(vscode.window.createTerminal).toHaveBeenCalledWith('WSL List');
        });
        it('should handle WSLError instances', async () => {
            const wslError = new errorHandler_1.WSLError(errorHandler_1.ErrorType.TIMEOUT, 'Custom timeout message', 'Operation took too long', ['Try again', 'Check WSL service']);
            await errorHandler_1.ErrorHandler.showError(wslError);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Custom timeout message', expect.any(String), expect.any(String), expect.any(String));
        });
    });
    describe('withTimeout', () => {
        it('should resolve when operation completes in time', async () => {
            const promise = Promise.resolve('success');
            const result = await errorHandler_1.ErrorHandler.withTimeout(promise, 1000, 'test operation');
            expect(result).toBe('success');
        });
        it('should reject with timeout error when operation takes too long', async () => {
            const promise = new Promise(resolve => setTimeout(resolve, 2000));
            await expect(errorHandler_1.ErrorHandler.withTimeout(promise, 100, 'slow operation')).rejects.toThrow(errorHandler_1.WSLError);
            try {
                await errorHandler_1.ErrorHandler.withTimeout(promise, 100, 'slow operation');
            }
            catch (error) {
                expect(error.type).toBe(errorHandler_1.ErrorType.TIMEOUT);
                expect(error.message).toContain('100ms');
            }
        });
    });
    describe('wrapAsync', () => {
        it('should execute function normally on success', async () => {
            const asyncFn = jest.fn().mockResolvedValue('result');
            const wrapped = errorHandler_1.ErrorHandler.wrapAsync(asyncFn, 'test operation');
            const result = await wrapped('arg1', 'arg2');
            expect(result).toBe('result');
            expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2');
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        it('should show error and rethrow on failure', async () => {
            const error = new Error('Test error');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrapped = errorHandler_1.ErrorHandler.wrapAsync(asyncFn, 'test operation');
            await expect(wrapped()).rejects.toThrow('Test error');
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });
    });
    describe('getUserFriendlyMessage', () => {
        it('should return user-friendly message for known errors', () => {
            const error = new Error('EACCES: permission denied');
            const message = errorHandler_1.ErrorHandler.getUserFriendlyMessage(error);
            expect(message).toContain('Permission Denied');
            expect(message).toContain('elevated permissions');
        });
        it('should handle unknown errors gracefully', () => {
            const error = new Error('Random error');
            const message = errorHandler_1.ErrorHandler.getUserFriendlyMessage(error);
            expect(message).toContain('Unknown Error');
            expect(message).toContain('unexpected error occurred');
        });
    });
    describe('isRecoverable', () => {
        it('should identify recoverable errors', () => {
            const recoverableErrors = [
                new Error('Network timeout'),
                new Error('Rate limit exceeded'),
                { code: 'ENOENT' },
                new Error('Connection failed')
            ];
            recoverableErrors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.isRecoverable(error)).toBe(true);
            });
        });
        it('should identify non-recoverable errors', () => {
            const nonRecoverableErrors = [
                new Error('wsl.exe not found'),
                new Error('Invalid distribution name'),
                new Error('Permission denied')
            ];
            nonRecoverableErrors.forEach(error => {
                expect(errorHandler_1.ErrorHandler.isRecoverable(error)).toBe(false);
            });
        });
    });
    describe('getErrorTelemetry', () => {
        it('should return anonymized telemetry data', () => {
            const error = new Error('Network error occurred');
            const telemetry = errorHandler_1.ErrorHandler.getErrorTelemetry(error);
            expect(telemetry).toHaveProperty('errorType', errorHandler_1.ErrorType.NETWORK_ERROR);
            expect(telemetry).toHaveProperty('timestamp');
            expect(telemetry).toHaveProperty('recoverable', true);
            expect(telemetry).toHaveProperty('hasRecoveryActions', true);
            // Should not contain sensitive data
            expect(JSON.stringify(telemetry)).not.toContain('Network error occurred');
        });
    });
    describe('executeRecoveryAction', () => {
        it('should open external URLs', async () => {
            vscode.window.showErrorMessage.mockResolvedValue('Visit https://docs.microsoft.com/windows/wsl/install');
            const error = new Error('wsl.exe not found');
            await errorHandler_1.ErrorHandler.showError(error);
            expect(vscode.env.openExternal).toHaveBeenCalledWith(expect.objectContaining({
                toString: expect.any(Function)
            }));
        });
        it('should create terminal for wsl commands', async () => {
            vscode.window.showErrorMessage.mockResolvedValue('Run "wsl --install" in an elevated PowerShell');
            const error = new Error('wsl.exe not found');
            await errorHandler_1.ErrorHandler.showError(error);
            expect(vscode.window.createTerminal).toHaveBeenCalledWith('Install WSL');
        });
    });
});
//# sourceMappingURL=errorHandler.test.js.map