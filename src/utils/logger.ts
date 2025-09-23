/**
 * Logging module for VSC WSL Manager
 * Provides configurable logging with different levels and output targets
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Conditional vscode import for test compatibility
let vscode: any;
try {
    vscode = require('vscode');
} catch {
    // Running in test environment - vscode not available
    vscode = null;
}

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
    private outputChannel: any; // vscode.OutputChannel when available
    private logLevel: LogLevel = LogLevel.INFO;
    private fileLoggingEnabled: boolean = false;
    private logFilePath?: string;
    private logBuffer: LogEntry[] = [];
    private readonly MAX_BUFFER_SIZE = 1000;
    private breadcrumbs: string[] = [];
    private readonly MAX_BREADCRUMBS = 20;
    private performanceMetrics: Map<string, number[]> = new Map();
    private streamWatchers: Set<(entry: LogEntry) => void> = new Set();
    private rotationSize: number = 10 * 1024 * 1024; // 10MB
    private currentFileSize: number = 0;
    
    private constructor() {
        if (vscode) {
            this.outputChannel = vscode.window.createOutputChannel('WSL Manager');
            this.loadConfiguration();

            // Watch for configuration changes
            vscode.workspace.onDidChangeConfiguration((e: any) => {
                if (e.affectsConfiguration('wsl-manager.logging')) {
                    this.loadConfiguration();
                }
            });
        } else {
            // Test environment - no output channel
            this.outputChannel = null;
            this.logLevel = LogLevel.DEBUG; // Enable all logs in tests
        }
    }
    
    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    
    private loadConfiguration(): void {
        if (!vscode) return;
        const config = vscode.workspace.getConfiguration('wsl-manager.logging');
        
        // Set log level
        const levelStr = (config.get('level', 'info') as string).toUpperCase();
        this.logLevel = LogLevel[levelStr as keyof typeof LogLevel] || LogLevel.INFO;
        
        // Set file logging
        this.fileLoggingEnabled = config.get('enableFileLogging', false) as boolean;
        this.rotationSize = (config.get('rotationSizeMB', 10) as number) * 1024 * 1024;
        
        if (this.fileLoggingEnabled) {
            const logDir = (config.get('logDirectory') as string) ||
                path.join(process.env.APPDATA || process.env.HOME || '', 'vsc-wsl-manager', 'logs');
            
            // Create log directory
            try {
                fs.mkdirSync(logDir, { recursive: true });
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                this.logFilePath = path.join(logDir, `wsl-manager-${timestamp}.log`);
                
                // Check if file exists and get its size
                if (fs.existsSync(this.logFilePath)) {
                    const stats = fs.statSync(this.logFilePath);
                    this.currentFileSize = stats.size;
                }
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
        if (!data) {return data;}
        
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
        if (!error) {return 'Unknown error';}
        
        if (error instanceof Error) {
            const stack = error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : '';
            return `${error.name}: ${error.message}${stack ? ' | ' + stack : ''}`;
        }
        
        return String(error);
    }
    
    private async writeToFile(message: string): Promise<void> {
        if (!this.fileLoggingEnabled || !this.logFilePath) {return;}
        
        try {
            const messageSize = Buffer.byteLength(message + '\n', 'utf8');
            
            // Check if rotation is needed
            if (this.currentFileSize + messageSize > this.rotationSize) {
                await this.rotateLogFile();
            }
            
            await fs.promises.appendFile(this.logFilePath, message + '\n', 'utf8');
            this.currentFileSize += messageSize;
        } catch (error) {
            // Disable file logging if write fails
            console.error('Failed to write to log file:', error);
            this.fileLoggingEnabled = false;
        }
    }
    
    private async rotateLogFile(): Promise<void> {
        if (!this.logFilePath) {return;}
        
        try {
            const dir = path.dirname(this.logFilePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedPath = path.join(dir, `wsl-manager-${timestamp}-rotated.log`);
            
            // Rename current file
            await fs.promises.rename(this.logFilePath, rotatedPath);
            
            // Create new file
            const newTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.logFilePath = path.join(dir, `wsl-manager-${newTimestamp}.log`);
            this.currentFileSize = 0;
            
            // Clean up old rotated files (keep last 5)
            const files = await fs.promises.readdir(dir);
            const rotatedFiles = files
                .filter(f => f.includes('-rotated.log'))
                .sort()
                .reverse();
            
            for (let i = 5; i < rotatedFiles.length; i++) {
                await fs.promises.unlink(path.join(dir, rotatedFiles[i])).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }
    
    private log(level: LogLevel, message: string, context?: Record<string, any>, error?: any): void {
        if (!this.shouldLog(level)) {return;}
        
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
        
        // Add to breadcrumbs for error context
        this.addBreadcrumb(`${LogLevel[level]}: ${message}`);
        
        // Notify stream watchers
        this.streamWatchers.forEach(watcher => {
            try {
                watcher(entry);
            } catch (e) {
                // Remove failed watchers
                this.streamWatchers.delete(watcher);
            }
        });
        
        const formattedMessage = this.formatMessage(entry);
        
        // Write to output channel
        if (this.outputChannel) {
            this.outputChannel.appendLine(formattedMessage);
        } else {
            // Test environment - output to console
            console.log(formattedMessage);
        }
        
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
        // Track metrics for analysis
        if (!this.performanceMetrics.has(operation)) {
            this.performanceMetrics.set(operation, []);
        }
        this.performanceMetrics.get(operation)!.push(duration);
        
        // Calculate statistics
        const metrics = this.performanceMetrics.get(operation)!;
        const avg = metrics.reduce((a, b) => a + b, 0) / metrics.length;
        const max = Math.max(...metrics);
        const min = Math.min(...metrics);
        
        this.info(`Performance: ${operation} completed in ${duration}ms`, {
            ...context,
            duration,
            operation,
            avg: Math.round(avg),
            max,
            min,
            count: metrics.length
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
        if (this.outputChannel) {
            this.outputChannel.show();
        }
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
     * Add a breadcrumb for error context
     */
    private addBreadcrumb(breadcrumb: string): void {
        this.breadcrumbs.push(`${new Date().toISOString().substr(11, 12)}: ${breadcrumb}`);
        if (this.breadcrumbs.length > this.MAX_BREADCRUMBS) {
            this.breadcrumbs.shift();
        }
    }
    
    /**
     * Start a performance timer
     */
    startTimer(operation: string): () => void {
        const startTime = Date.now();
        return () => {
            const duration = Date.now() - startTime;
            this.performance(operation, duration);
        };
    }
    
    /**
     * Add a log stream watcher
     */
    addStreamWatcher(watcher: (entry: LogEntry) => void): () => void {
        this.streamWatchers.add(watcher);
        return () => this.streamWatchers.delete(watcher);
    }
    
    /**
     * Get performance statistics
     */
    getPerformanceStats(): Record<string, any> {
        const stats: Record<string, any> = {};
        
        this.performanceMetrics.forEach((metrics, operation) => {
            const sorted = [...metrics].sort((a, b) => a - b);
            const p95Index = Math.floor(sorted.length * 0.95);
            
            stats[operation] = {
                count: metrics.length,
                avg: Math.round(metrics.reduce((a, b) => a + b, 0) / metrics.length),
                min: Math.min(...metrics),
                max: Math.max(...metrics),
                p95: sorted[p95Index] || sorted[sorted.length - 1]
            };
        });
        
        return stats;
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
            `- Node Version: ${process.version}`,
            '',
            '## Performance Metrics',
            ...Object.entries(this.getPerformanceStats()).map(
                ([op, stats]: [string, any]) => `- ${op}: avg=${stats.avg}ms, p95=${stats.p95}ms, count=${stats.count}`
            ),
            '',
            '## Error Context (Breadcrumbs)',
            ...this.breadcrumbs.slice(-10)
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