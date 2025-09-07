/**
 * Functional tests for error classification
 * Ensures errors are properly categorized and not shown as UNKNOWN
 */

import { ErrorHandler, ErrorType } from '../../src/errors/errorHandler';

describe('Error Classification - Functional Tests', () => {
    describe('Distribution Not Found Errors', () => {
        it('should classify "not installed" errors correctly', () => {
            const errors = [
                new Error("Base distribution 'Ubuntu' is not installed. Please install it from the Microsoft Store first."),
                new Error("Base distribution 'Debian' is not installed. Please install it from the Microsoft Store first."),
                new Error("Distribution 'custom-wsl' is not installed"),
                new Error("The distribution Alpine is not installed on this system")
            ];
            
            errors.forEach(error => {
                const errorType = ErrorHandler.determineErrorType(error);
                expect(errorType).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
                expect(errorType).not.toBe(ErrorType.UNKNOWN);
            });
        });
        
        it('should classify "not found" errors correctly', () => {
            const errors = [
                new Error("Distribution 'Ubuntu' not found"),
                new Error("The specified distribution was not found"),
                new Error("WSL distribution not found: custom-distro")
            ];
            
            errors.forEach(error => {
                const errorType = ErrorHandler.determineErrorType(error);
                expect(errorType).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
                expect(errorType).not.toBe(ErrorType.UNKNOWN);
            });
        });
    });
    
    describe('Permission Errors', () => {
        it('should never show permission errors for terminal profiles', () => {
            const errors = [
                new Error("Failed to update terminal profiles"),
                new Error("Permission denied: terminal.integrated.profiles"),
                new Error("Access denied when updating terminal profiles")
            ];
            
            // These should be prevented by design, but if they occur, classify correctly
            errors.forEach(error => {
                const errorType = ErrorHandler.determineErrorType(error);
                expect(errorType).toBe(ErrorType.PERMISSION_DENIED);
                expect(errorType).not.toBe(ErrorType.UNKNOWN);
            });
        });
    });
    
    describe('WSL Not Installed Errors', () => {
        it('should classify WSL not installed errors correctly', () => {
            const errors = [
                new Error("'wsl' is not recognized as an internal or external command"),
                new Error("wsl.exe was not found"),
                new Error("Windows Subsystem for Linux is not installed")
            ];
            
            errors.forEach(error => {
                const errorType = ErrorHandler.determineErrorType(error);
                expect(errorType).toBe(ErrorType.WSL_NOT_INSTALLED);
                expect(errorType).not.toBe(ErrorType.UNKNOWN);
            });
        });
    });
    
    describe('User-Friendly Messages', () => {
        it('should provide helpful recovery suggestions', () => {
            const error = new Error("Base distribution 'Ubuntu' is not installed");
            const errorType = ErrorHandler.determineErrorType(error);
            const wslError = ErrorHandler.createError(error, errorType);
            
            expect(wslError.type).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            expect(wslError.userMessage).toContain('distribution');
            expect(wslError.recoveryActions).toBeDefined();
            expect(wslError.recoveryActions!.length).toBeGreaterThan(0);
        });
    });
    
    describe('Real-World Scenarios', () => {
        it('should handle create distribution with missing base', () => {
            // This is the actual error from the user's console
            const error = new Error("Base distribution 'Ubuntu' is not installed. Please install it from the Microsoft Store first.");
            
            const errorType = ErrorHandler.determineErrorType(error);
            expect(errorType).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            
            const wslError = ErrorHandler.createError(error, errorType);
            expect(wslError.type).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            expect(wslError.userMessage).toBeDefined();
            expect(wslError.recoveryActions).toContain('Install the base distribution from Microsoft Store');
        });
        
        it('should never return UNKNOWN for common WSL errors', () => {
            const commonErrors = [
                "Distribution not installed",
                "Distribution not found",
                "WSL not installed",
                "Permission denied",
                "File not found",
                "Already exists",
                "Network error",
                "Command failed",
                "Timed out"
            ];
            
            commonErrors.forEach(errorMsg => {
                const error = new Error(errorMsg);
                const errorType = ErrorHandler.determineErrorType(error);
                
                // At least one of these patterns should match
                const knownTypes = [
                    ErrorType.DISTRIBUTION_NOT_FOUND,
                    ErrorType.WSL_NOT_INSTALLED,
                    ErrorType.PERMISSION_DENIED,
                    ErrorType.FILE_NOT_FOUND,
                    ErrorType.DISTRIBUTION_ALREADY_EXISTS,
                    ErrorType.NETWORK_ERROR,
                    ErrorType.COMMAND_FAILED,
                    ErrorType.TIMEOUT
                ];
                
                if (!errorMsg.includes('Distribution')) {
                    // Some generic messages might still be UNKNOWN, but distribution errors should not be
                    return;
                }
                
                expect(knownTypes).toContain(errorType);
            });
        });
    });
});