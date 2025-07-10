/**
 * Logging module for VSC WSL Manager
 * Provides configurable logging with different levels and output targets
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, any>;
    error?: any;
}

export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;
    private fileLoggingEnabled: boolean = false;
    private logFilePath?: string;
    private logBuffer: LogEntry[] = [];
    private readonly MAX_BUFFER_SIZE = 1000;
    
    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('WSL Manager');
        this.loadConfiguration();
        
        // Watch for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('wsl-manager.logging')) {
                this.loadConfiguration();
            }
        });
    }
    
    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    
    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('wsl-manager.logging');
        
        // Set log level
        const levelStr = config.get<string>('level', 'info').toUpperCase();
        this.logLevel = LogLevel[levelStr as keyof typeof LogLevel] || LogLevel.INFO;
        
        // Set file logging
        this.fileLoggingEnabled = config.get<boolean>('enableFileLogging', false);
        
        if (this.fileLoggingEnabled) {
            const logDir = config.get<string>('logDirectory') || 
                path.join(process.env.APPDATA || process.env.HOME || '', 'vsc-wsl-manager', 'logs');
            
            // Create log directory
            try {
                fs.mkdirSync(logDir, { recursive: true });
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                this.logFilePath = path.join(logDir, `wsl-manager-${timestamp}.log`);
            } catch (error) {
                console.error('Failed to create log directory:', error);
                this.fileLoggingEnabled = false;
            }
        }
    }
    
    private shouldLog(level: LogLevel): boolean {
        return level >= this.logLevel;
    }
    
    private formatMessage(entry: LogEntry): string {
        const levelStr = LogLevel[entry.level].padEnd(5);
        let message = `[${entry.timestamp}] [${levelStr}] ${entry.message}`;
        
        if (entry.context && Object.keys(entry.context).length > 0) {
            // Sanitize context to remove sensitive data
            const sanitizedContext = this.sanitizeData(entry.context);
            message += ` | Context: ${JSON.stringify(sanitizedContext)}`;
        }
        
        if (entry.error) {
            const errorDetails = this.formatError(entry.error);
            message += ` | Error: ${errorDetails}`;
        }
        
        return message;
    }
    
    private sanitizeData(data: any): any {
        if (!data) return data;
        
        // List of sensitive keys to redact
        const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
        
        if (typeof data === 'string') {
            // Redact potential file paths containing user info
            return data.replace(/\/home\/[^\/]+/g, '/home/***')
                      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\***')
                      .replace(/\/Users\/[^\/]+/g, '/Users/***');
        }
        
        if (typeof data === 'object') {
            const sanitized: any = Array.isArray(data) ? [] : {};
            
            for (const key in data) {
                const lowerKey = key.toLowerCase();
                if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
                    sanitized[key] = '[REDACTED]';
                } else {
                    sanitized[key] = this.sanitizeData(data[key]);
                }
            }
            
            return sanitized;
        }
        
        return data;
    }
    
    private formatError(error: any): string {
        if (!error) return 'Unknown error';
        
        if (error instanceof Error) {
            const stack = error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : '';
            return `${error.name}: ${error.message}${stack ? ' | ' + stack : ''}`;
        }
        
        return String(error);
    }
    
    private async writeToFile(message: string): Promise<void> {
        if (!this.fileLoggingEnabled || !this.logFilePath) return;
        
        try {
            await fs.promises.appendFile(this.logFilePath, message + '\n', 'utf8');
        } catch (error) {
            // Disable file logging if write fails
            console.error('Failed to write to log file:', error);
            this.fileLoggingEnabled = false;
        }
    }
    
    private log(level: LogLevel, message: string, context?: Record<string, any>, error?: any): void {
        if (!this.shouldLog(level)) return;
        
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error
        };
        
        // Add to buffer
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
            this.logBuffer.shift();
        }
        
        const formattedMessage = this.formatMessage(entry);
        
        // Write to output channel
        this.outputChannel.appendLine(formattedMessage);
        
        // Write to console in development
        if (process.env.NODE_ENV === 'development') {
            console.log(formattedMessage);
        }
        
        // Write to file asynchronously
        if (this.fileLoggingEnabled) {
            this.writeToFile(formattedMessage).catch(() => {});
        }
    }
    
    debug(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, context);
    }
    
    info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context);
    }
    
    warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context);
    }
    
    error(message: string, error?: any, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, context, error);
    }
    
    /**
     * Log a performance measurement
     */
    performance(operation: string, duration: number, context?: Record<string, any>): void {
        this.info(`Performance: ${operation} completed in ${duration}ms`, {
            ...context,
            duration,
            operation
        });
    }
    
    /**
     * Log a security event
     */
    security(event: string, context?: Record<string, any>): void {
        this.warn(`Security: ${event}`, {
            ...context,
            securityEvent: true
        });
    }
    
    /**
     * Create a child logger with additional context
     */
    child(context: Record<string, any>): ChildLogger {
        return new ChildLogger(this, context);
    }
    
    /**
     * Show the output channel
     */
    show(): void {
        this.outputChannel.show();
    }
    
    /**
     * Get recent log entries
     */
    getRecentLogs(count: number = 100): LogEntry[] {
        return this.logBuffer.slice(-count);
    }
    
    /**
     * Clear log buffer
     */
    clearLogs(): void {
        this.logBuffer = [];
        this.outputChannel.clear();
    }
    
    /**
     * Generate a diagnostic report
     */
    async generateDiagnosticReport(): Promise<string> {
        const report: string[] = [
            '# WSL Manager Diagnostic Report',
            `Generated: ${new Date().toISOString()}`,
            '',
            '## Configuration',
            `- Log Level: ${LogLevel[this.logLevel]}`,
            `- File Logging: ${this.fileLoggingEnabled}`,
            `- Log File: ${this.logFilePath || 'N/A'}`,
            '',
            '## Recent Errors',
            ...this.logBuffer
                .filter(entry => entry.level === LogLevel.ERROR)
                .slice(-10)
                .map(entry => `- ${entry.timestamp}: ${entry.message}`),
            '',
            '## Recent Warnings',
            ...this.logBuffer
                .filter(entry => entry.level === LogLevel.WARN)
                .slice(-10)
                .map(entry => `- ${entry.timestamp}: ${entry.message}`),
            '',
            '## System Information',
            `- VS Code Version: ${vscode.version}`,
            `- Platform: ${process.platform}`,
            `- Architecture: ${process.arch}`,
            `- Node Version: ${process.version}`
        ];
        
        return report.join('\n');
    }
}

/**
 * Child logger that includes additional context
 */
export class ChildLogger {
    constructor(
        private parent: Logger,
        private context: Record<string, any>
    ) {}
    
    private mergeContext(additionalContext?: Record<string, any>): Record<string, any> {
        return { ...this.context, ...additionalContext };
    }
    
    debug(message: string, context?: Record<string, any>): void {
        this.parent.debug(message, this.mergeContext(context));
    }
    
    info(message: string, context?: Record<string, any>): void {
        this.parent.info(message, this.mergeContext(context));
    }
    
    warn(message: string, context?: Record<string, any>): void {
        this.parent.warn(message, this.mergeContext(context));
    }
    
    error(message: string, error?: any, context?: Record<string, any>): void {
        this.parent.error(message, error, this.mergeContext(context));
    }
}

// Export singleton instance
export const logger = Logger.getInstance();