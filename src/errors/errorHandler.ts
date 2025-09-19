/**
 * Centralized error handling module for VSC WSL Manager
 * Provides user-friendly error messages and recovery suggestions
 */

import * as vscode from 'vscode';

/**
 * Custom error types for specific WSL scenarios
 */
export enum ErrorType {
    WSL_NOT_INSTALLED = 'WSL_NOT_INSTALLED',
    DISTRIBUTION_NOT_FOUND = 'DISTRIBUTION_NOT_FOUND',
    DISTRIBUTION_ALREADY_EXISTS = 'DISTRIBUTION_ALREADY_EXISTS',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    INVALID_INPUT = 'INVALID_INPUT',
    COMMAND_FAILED = 'COMMAND_FAILED',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    SECURITY_VIOLATION = 'SECURITY_VIOLATION',
    TIMEOUT = 'TIMEOUT',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Custom error class with additional context
 */
export class WSLError extends Error {
    constructor(
        public type: ErrorType,
        message: string,
        public details?: string,
        public recoveryActions?: string[]
    ) {
        super(message);
        this.name = 'WSLError';
    }
}

/**
 * Error handler utility class
 */
export class ErrorHandler {
    private static readonly errorMessages: Map<ErrorType, { title: string; description: string }> = new Map([
        [ErrorType.WSL_NOT_INSTALLED, {
            title: 'WSL Not Installed',
            description: 'Windows Subsystem for Linux is not installed on this system.'
        }],
        [ErrorType.DISTRIBUTION_NOT_FOUND, {
            title: 'Distribution Not Found',
            description: 'The specified WSL distribution does not exist.'
        }],
        [ErrorType.DISTRIBUTION_ALREADY_EXISTS, {
            title: 'Distribution Already Exists',
            description: 'A distribution with this name already exists.'
        }],
        [ErrorType.PERMISSION_DENIED, {
            title: 'Permission Denied',
            description: 'The operation requires elevated permissions.'
        }],
        [ErrorType.NETWORK_ERROR, {
            title: 'Network Error',
            description: 'Failed to download required resources.'
        }],
        [ErrorType.DOWNLOAD_FAILED, {
            title: 'Download Failed',
            description: 'Failed to download the distribution.'
        }],
        [ErrorType.FILE_NOT_FOUND, {
            title: 'File Not Found',
            description: 'The specified file could not be found.'
        }],
        [ErrorType.INVALID_INPUT, {
            title: 'Invalid Input',
            description: 'The provided input is invalid.'
        }],
        [ErrorType.COMMAND_FAILED, {
            title: 'Command Failed',
            description: 'The WSL command failed to execute.'
        }],
        [ErrorType.RATE_LIMIT_EXCEEDED, {
            title: 'Rate Limit Exceeded',
            description: 'Too many operations attempted. Please wait before trying again.'
        }],
        [ErrorType.SECURITY_VIOLATION, {
            title: 'Security Violation',
            description: 'The operation was blocked for security reasons.'
        }],
        [ErrorType.TIMEOUT, {
            title: 'Operation Timeout',
            description: 'The operation took too long to complete.'
        }],
        [ErrorType.UNKNOWN, {
            title: 'Unknown Error',
            description: 'An unexpected error occurred.'
        }]
    ]);

    private static readonly recoveryActions: Map<ErrorType, string[]> = new Map([
        [ErrorType.WSL_NOT_INSTALLED, [
            'Install WSL from the Microsoft Store',
            'Run "wsl --install" in an elevated PowerShell',
            'Visit https://docs.microsoft.com/windows/wsl/install'
        ]],
        [ErrorType.DISTRIBUTION_NOT_FOUND, [
            'Check the distribution name spelling',
            'Run "wsl --list" to see available distributions',
            'Install the distribution from the Microsoft Store'
        ]],
        [ErrorType.DISTRIBUTION_ALREADY_EXISTS, [
            'Choose a different name for the distribution',
            'Delete the existing distribution first',
            'Use the import feature with a different name'
        ]],
        [ErrorType.PERMISSION_DENIED, [
            'Run VS Code as Administrator',
            'Check file/folder permissions',
            'Ensure your user account has necessary privileges'
        ]],
        [ErrorType.NETWORK_ERROR, [
            'Check your internet connection',
            'Verify proxy settings if behind a firewall',
            'Try again later'
        ]],
        [ErrorType.DOWNLOAD_FAILED, [
            'Check your internet connection',
            'Verify the distribution is available',
            'Try downloading a different distribution',
            'Check available disk space'
        ]],
        [ErrorType.FILE_NOT_FOUND, [
            'Verify the file path is correct',
            'Check if the file exists',
            'Ensure you have read permissions for the file'
        ]],
        [ErrorType.RATE_LIMIT_EXCEEDED, [
            'Wait a few moments before trying again',
            'Reduce the frequency of operations',
            'Check the rate limit status in settings'
        ]],
        [ErrorType.TIMEOUT, [
            'Check if the WSL service is running',
            'Restart the WSL service',
            'Try the operation with a smaller dataset'
        ]]
    ]);

    /**
     * Parse error and determine its type
     */
    static determineErrorType(error: any): ErrorType {
        const errorMessage = (error?.message || error?.toString() || '').toLowerCase();
        const errorCode = error?.code;

        // Check for specific error patterns (case-insensitive)
        if (errorMessage.includes('wsl') && errorMessage.includes('not recognized')) {
            return ErrorType.WSL_NOT_INSTALLED;
        }
        if (errorMessage.includes('wsl.exe') && errorMessage.includes('not found')) {
            return ErrorType.WSL_NOT_INSTALLED;
        }
        if (errorMessage.includes('distribution') && errorMessage.includes('not found')) {
            return ErrorType.DISTRIBUTION_NOT_FOUND;
        }
        if (errorMessage.includes('distribution') && errorMessage.includes('not installed')) {
            return ErrorType.DISTRIBUTION_NOT_FOUND;
        }
        if (errorMessage.includes('not available locally')) {
            return ErrorType.FILE_NOT_FOUND;
        }
        if (errorMessage.includes('distro not found')) {
            return ErrorType.DISTRIBUTION_NOT_FOUND;
        }
        if (errorMessage.includes('already exists') || errorMessage.includes('already registered')) {
            return ErrorType.DISTRIBUTION_ALREADY_EXISTS;
        }
        if (errorMessage.includes('permission denied') || errorMessage.includes('access denied') || errorCode === 'EACCES') {
            return ErrorType.PERMISSION_DENIED;
        }
        if (errorMessage.includes('enoent') || errorCode === 'ENOENT' || errorMessage.includes('system cannot find')) {
            return ErrorType.FILE_NOT_FOUND;
        }
        if (errorMessage.includes('no such file')) {
            return ErrorType.FILE_NOT_FOUND;
        }
        if (errorMessage.includes('network') || errorMessage.includes('enetunreach') || errorCode === 'ENETUNREACH' || errorMessage.includes('econnrefused')) {
            return ErrorType.NETWORK_ERROR;
        }
        if (errorMessage.includes('download') && (errorMessage.includes('failed') || errorMessage.includes('error'))) {
            return ErrorType.DOWNLOAD_FAILED;
        }
        if (errorMessage.includes('no download url') || errorMessage.includes('no tar source')) {
            return ErrorType.DOWNLOAD_FAILED;
        }
        if (errorMessage.includes('http') && errorMessage.includes(':')) {
            return ErrorType.DOWNLOAD_FAILED;
        }
        if (errorMessage.includes('enotfound') || errorMessage.includes('getaddrinfo')) {
            return ErrorType.NETWORK_ERROR;
        }
        if (errorMessage.includes('econnrefused') || errorMessage.includes('econnreset')) {
            return ErrorType.NETWORK_ERROR;
        }
        if (errorMessage.includes('unable to verify') || errorMessage.includes('self signed')) {
            return ErrorType.NETWORK_ERROR;
        }
        if (errorMessage.includes('download failed') || errorMessage.includes('download timeout')) {
            return ErrorType.DOWNLOAD_FAILED;
        }
        if (errorMessage.includes('cannot reach download server')) {
            return ErrorType.NETWORK_ERROR;
        }
        if (errorMessage.includes('rate limit exceeded')) {
            return ErrorType.RATE_LIMIT_EXCEEDED;
        }
        if (errorMessage.includes('security validation failed')) {
            return ErrorType.SECURITY_VIOLATION;
        }
        if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
            return ErrorType.TIMEOUT;
        }
        if (errorMessage.includes('invalid') && errorMessage.includes('name')) {
            return ErrorType.INVALID_INPUT;
        }
        if (errorMessage.includes('command failed') || errorMessage.includes('exit code')) {
            return ErrorType.COMMAND_FAILED;
        }

        return ErrorType.UNKNOWN;
    }

    /**
     * Create a WSLError from a generic error
     */
    static createError(error: any): WSLError {
        const type = this.determineErrorType(error);
        const errorInfo = this.errorMessages.get(type) || this.errorMessages.get(ErrorType.UNKNOWN)!;
        const recoveryActions = this.recoveryActions.get(type);
        
        const details = error?.stderr || error?.details || error?.message || 'No additional details available';
        
        return new WSLError(
            type,
            errorInfo.title,
            details,
            recoveryActions
        );
    }

    /**
     * Show error to user with recovery options
     */
    static async showError(error: any, operation?: string): Promise<void> {
        const wslError = error instanceof WSLError ? error : this.createError(error);
        
        const message = operation 
            ? `Failed to ${operation}: ${wslError.message}`
            : wslError.message;

        // Log to console for debugging
        console.error('[WSL Manager Error]', {
            type: wslError.type,
            message: wslError.message,
            details: wslError.details,
            stack: error?.stack
        });

        // Show error with recovery actions
        if (wslError.recoveryActions && wslError.recoveryActions.length > 0) {
            const actions = ['Show Details', ...wslError.recoveryActions.slice(0, 2)];
            const selection = await vscode.window.showErrorMessage(
                message,
                ...actions
            );

            if (selection === 'Show Details') {
                this.showDetailedError(wslError);
            } else if (selection && wslError.recoveryActions.includes(selection)) {
                this.executeRecoveryAction(selection);
            }
        } else {
            vscode.window.showErrorMessage(message);
        }
    }

    /**
     * Show detailed error information
     */
    private static showDetailedError(error: WSLError): void {
        const details = `
**Error Type:** ${error.type}

**Message:** ${error.message}

**Details:** ${error.details || 'No additional details'}

**Recovery Actions:**
${error.recoveryActions ? error.recoveryActions.map(a => `- ${a}`).join('\n') : 'No recovery actions available'}
        `.trim();

        vscode.window.showInformationMessage(details, { modal: true });
    }

    /**
     * Execute recovery action
     */
    private static executeRecoveryAction(action: string): void {
        // Handle specific recovery actions
        if (action.includes('https://')) {
            vscode.env.openExternal(vscode.Uri.parse(action.match(/https:\/\/[^\s]+/)![0]));
        } else if (action.includes('wsl --install')) {
            const terminal = vscode.window.createTerminal('Install WSL');
            terminal.show();
            terminal.sendText('powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList \'-Command wsl --install\'"');
        } else if (action.includes('wsl --list')) {
            const terminal = vscode.window.createTerminal('WSL List');
            terminal.show();
            terminal.sendText('wsl --list');
        }
        // Handle download-related recovery actions
        else if (action === 'Check your internet connection') {
            vscode.commands.executeCommand('wsl-manager.testConnectivity');
        } else if (action === 'Verify the distribution is available') {
            vscode.commands.executeCommand('wsl-manager.validateDistributions');
        } else if (action === 'Try downloading a different distribution') {
            vscode.commands.executeCommand('wsl-manager.downloadDistribution');
        } else if (action === 'Check available disk space') {
            const terminal = vscode.window.createTerminal('Check Disk Space');
            terminal.show();
            if (process.platform === 'win32') {
                terminal.sendText('wmic logicaldisk get size,freespace,caption');
            } else {
                terminal.sendText('df -h');
            }
        }
        // Handle other common actions
        else if (action.includes('Check the distribution name')) {
            vscode.commands.executeCommand('wsl-manager.refreshDistributions');
        } else if (action.includes('Choose a different name')) {
            vscode.window.showInformationMessage('Please try the operation again with a different name.');
        } else if (action.includes('Run VS Code as Administrator')) {
            vscode.window.showWarningMessage('Please restart VS Code as Administrator to perform this operation.');
        }
    }

    /**
     * Handle async operation with timeout
     */
    static async withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number,
        operation: string
    ): Promise<T> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new WSLError(
                    ErrorType.TIMEOUT,
                    `Operation timed out after ${timeoutMs}ms`,
                    `The operation "${operation}" took too long to complete`,
                    ['Check if WSL service is responsive', 'Try again with a shorter timeout']
                ));
            }, timeoutMs);
        });

        return Promise.race([promise, timeoutPromise]);
    }

    /**
     * Wrap async function with error handling
     */
    static wrapAsync<T extends (...args: any[]) => Promise<any>>(
        fn: T,
        operation: string
    ): T {
        return (async (...args: Parameters<T>) => {
            try {
                return await fn(...args);
            } catch (error) {
                await this.showError(error, operation);
                throw error;
            }
        }) as T;
    }

    /**
     * Create a user-friendly error message
     */
    static getUserFriendlyMessage(error: any): string {
        const wslError = error instanceof WSLError ? error : this.createError(error);
        const errorInfo = this.errorMessages.get(wslError.type) || this.errorMessages.get(ErrorType.UNKNOWN)!;
        
        return `${errorInfo.title}: ${errorInfo.description}`;
    }

    /**
     * Check if error is recoverable
     */
    static isRecoverable(error: any): boolean {
        const wslError = error instanceof WSLError ? error : this.createError(error);
        const recoverableTypes = [
            ErrorType.NETWORK_ERROR,
            ErrorType.TIMEOUT,
            ErrorType.RATE_LIMIT_EXCEEDED,
            ErrorType.FILE_NOT_FOUND
        ];
        
        return recoverableTypes.includes(wslError.type);
    }

    /**
     * Create error telemetry data (anonymized)
     */
    static getErrorTelemetry(error: any): Record<string, any> {
        const wslError = error instanceof WSLError ? error : this.createError(error);
        
        return {
            errorType: wslError.type,
            timestamp: new Date().toISOString(),
            recoverable: this.isRecoverable(wslError),
            hasRecoveryActions: !!(wslError.recoveryActions && wslError.recoveryActions.length > 0)
        };
    }
}