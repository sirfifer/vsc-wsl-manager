/**
 * Unit tests for ErrorHandler module
 * Tests error classification, user-friendly messages, and recovery actions
 */

import { ErrorHandler, ErrorType, WSLError } from '../../src/errors/errorHandler';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode');

describe('ErrorHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock vscode methods
        (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue(undefined);
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);
        (vscode.env.openExternal as jest.Mock).mockResolvedValue(true);
        (vscode.window.createTerminal as jest.Mock).mockReturnValue({
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
                expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.WSL_NOT_INSTALLED);
            });
        });
        
        it('should identify distribution not found errors', () => {
            const errors = [
                { message: 'Distribution "Ubuntu" not found' },
                { message: 'The specified distribution was not found' },
                new Error('Distribution test-distro not found')
            ];
            
            errors.forEach(error => {
                expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            });
        });
        
        it('should identify permission errors', () => {
            const errors = [
                { message: 'Permission denied', code: 'EACCES' },
                { message: 'Access denied to file' },
                new Error('EACCES: permission denied')
            ];
            
            errors.forEach(error => {
                expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.PERMISSION_DENIED);
            });
        });
        
        it('should identify file not found errors', () => {
            const errors = [
                { code: 'ENOENT' },
                { message: 'ENOENT: no such file or directory' },
                new Error('File not found: /path/to/file')
            ];
            
            errors.forEach(error => {
                expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.FILE_NOT_FOUND);
            });
        });
        
        it('should identify network errors', () => {
            const errors = [
                { message: 'network error occurred' },
                { message: 'Failed to download package' },
                { code: 'ENETUNREACH' }
            ];
            
            errors.forEach(error => {
                expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.NETWORK_ERROR);
            });
        });
        
        it('should identify rate limit errors', () => {
            const error = new Error('Rate limit exceeded for import operations');
            expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.RATE_LIMIT_EXCEEDED);
        });
        
        it('should identify security violations', () => {
            const error = new Error('Security validation failed: dangerous command detected');
            expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.SECURITY_VIOLATION);
        });
        
        it('should identify timeout errors', () => {
            const errors = [
                { message: 'Operation timed out' },
                { message: 'Command timeout after 30s' },
                new Error('Request timeout')
            ];
            
            errors.forEach(error => {
                expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.TIMEOUT);
            });
        });
        
        it('should identify invalid input errors', () => {
            const error = new Error('Invalid distribution name: contains illegal characters');
            expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.INVALID_INPUT);
        });
        
        it('should identify command failures', () => {
            const errors = [
                { message: 'Command failed with exit code 1' },
                new Error('WSL command failed: non-zero exit')
            ];
            
            errors.forEach(error => {
                expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.COMMAND_FAILED);
            });
        });
        
        it('should return UNKNOWN for unrecognized errors', () => {
            const error = new Error('Some random error');
            expect(ErrorHandler.determineErrorType(error)).toBe(ErrorType.UNKNOWN);
        });
    });
    
    describe('createError', () => {
        it('should create WSLError with proper properties', () => {
            const originalError = new Error('Distribution "test" not found');
            const wslError = ErrorHandler.createError(originalError);
            
            expect(wslError).toBeInstanceOf(WSLError);
            expect(wslError.type).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
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
            
            const wslError = ErrorHandler.createError(error);
            expect(wslError.details).toBe('wsl: Distribution not found');
        });
        
        it('should handle string errors', () => {
            const wslError = ErrorHandler.createError('Permission denied');
            expect(wslError.type).toBe(ErrorType.PERMISSION_DENIED);
        });
    });
    
    describe('showError', () => {
        it('should show error message with operation context', async () => {
            const error = new Error('File not found');
            await ErrorHandler.showError(error, 'import distribution');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to import distribution'),
                expect.any(String),
                expect.any(String),
                expect.any(String)
            );
        });
        
        it('should show recovery actions when available', async () => {
            const error = new Error('wsl.exe not found');
            await ErrorHandler.showError(error);
            
            const call = (vscode.window.showErrorMessage as jest.Mock).mock.calls[0];
            expect(call[0]).toContain('WSL Not Installed');
            expect(call.slice(1)).toContain('Show Details');
        });
        
        it('should show detailed error when requested', async () => {
            (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Show Details');
            
            const error = new Error('Network error');
            await ErrorHandler.showError(error);
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Error Type:'),
                { modal: true }
            );
        });
        
        it('should execute recovery action when selected', async () => {
            (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Run "wsl --list" to see available distributions');
            
            const error = new Error('Distribution not found');
            await ErrorHandler.showError(error);
            
            expect(vscode.window.createTerminal).toHaveBeenCalledWith('WSL List');
        });
        
        it('should handle WSLError instances', async () => {
            const wslError = new WSLError(
                ErrorType.TIMEOUT,
                'Custom timeout message',
                'Operation took too long',
                ['Try again', 'Check WSL service']
            );
            
            await ErrorHandler.showError(wslError);
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Custom timeout message',
                expect.any(String),
                expect.any(String),
                expect.any(String)
            );
        });
    });
    
    describe('withTimeout', () => {
        it('should resolve when operation completes in time', async () => {
            const promise = Promise.resolve('success');
            const result = await ErrorHandler.withTimeout(promise, 1000, 'test operation');
            expect(result).toBe('success');
        });
        
        it('should reject with timeout error when operation takes too long', async () => {
            const promise = new Promise(resolve => setTimeout(resolve, 2000));
            
            await expect(
                ErrorHandler.withTimeout(promise, 100, 'slow operation')
            ).rejects.toThrow(WSLError);
            
            try {
                await ErrorHandler.withTimeout(promise, 100, 'slow operation');
            } catch (error: any) {
                expect(error.type).toBe(ErrorType.TIMEOUT);
                expect(error.message).toContain('100ms');
            }
        });
    });
    
    describe('wrapAsync', () => {
        it('should execute function normally on success', async () => {
            const asyncFn = jest.fn().mockResolvedValue('result');
            const wrapped = ErrorHandler.wrapAsync(asyncFn, 'test operation');
            
            const result = await wrapped('arg1', 'arg2');
            
            expect(result).toBe('result');
            expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2');
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        
        it('should show error and rethrow on failure', async () => {
            const error = new Error('Test error');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrapped = ErrorHandler.wrapAsync(asyncFn, 'test operation');
            
            await expect(wrapped()).rejects.toThrow('Test error');
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });
    });
    
    describe('getUserFriendlyMessage', () => {
        it('should return user-friendly message for known errors', () => {
            const error = new Error('EACCES: permission denied');
            const message = ErrorHandler.getUserFriendlyMessage(error);
            
            expect(message).toContain('Permission Denied');
            expect(message).toContain('elevated permissions');
        });
        
        it('should handle unknown errors gracefully', () => {
            const error = new Error('Random error');
            const message = ErrorHandler.getUserFriendlyMessage(error);
            
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
                expect(ErrorHandler.isRecoverable(error)).toBe(true);
            });
        });
        
        it('should identify non-recoverable errors', () => {
            const nonRecoverableErrors = [
                new Error('wsl.exe not found'),
                new Error('Invalid distribution name'),
                new Error('Permission denied')
            ];
            
            nonRecoverableErrors.forEach(error => {
                expect(ErrorHandler.isRecoverable(error)).toBe(false);
            });
        });
    });
    
    describe('getErrorTelemetry', () => {
        it('should return anonymized telemetry data', () => {
            const error = new Error('Network error occurred');
            const telemetry = ErrorHandler.getErrorTelemetry(error);
            
            expect(telemetry).toHaveProperty('errorType', ErrorType.NETWORK_ERROR);
            expect(telemetry).toHaveProperty('timestamp');
            expect(telemetry).toHaveProperty('recoverable', true);
            expect(telemetry).toHaveProperty('hasRecoveryActions', true);
            
            // Should not contain sensitive data
            expect(JSON.stringify(telemetry)).not.toContain('Network error occurred');
        });
    });
    
    describe('executeRecoveryAction', () => {
        it('should open external URLs', async () => {
            (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Visit https://docs.microsoft.com/windows/wsl/install');
            
            const error = new Error('wsl.exe not found');
            await ErrorHandler.showError(error);
            
            expect(vscode.env.openExternal).toHaveBeenCalledWith(
                expect.objectContaining({
                    toString: expect.any(Function)
                })
            );
        });
        
        it('should create terminal for wsl commands', async () => {
            (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Run "wsl --install" in an elevated PowerShell');
            
            const error = new Error('wsl.exe not found');
            await ErrorHandler.showError(error);
            
            expect(vscode.window.createTerminal).toHaveBeenCalledWith('Install WSL');
        });
    });
});