/**
 * SecurityValidator module for enhanced security measures
 * Implements rate limiting, command whitelisting, and permission checks
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    identifier: string;
}

/**
 * Command execution context
 */
export interface CommandContext {
    command: string;
    args: string[];
    user?: string;
    timestamp: number;
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
    allowed: boolean;
    reason?: string;
    remainingRequests?: number;
    resetTime?: Date;
}

/**
 * Security validator for command execution
 */
export class SecurityValidator {
    private static instance: SecurityValidator;
    private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
    private commandHistory: CommandContext[] = [];
    private readonly maxHistorySize = 1000;
    
    /**
     * Rate limit configurations for different operations
     */
    private readonly rateLimits: { [key: string]: RateLimitConfig } = {
        create: { maxRequests: 10, windowMs: 60000, identifier: 'create' },      // 10 per minute
        import: { maxRequests: 5, windowMs: 60000, identifier: 'import' },       // 5 per minute
        export: { maxRequests: 20, windowMs: 60000, identifier: 'export' },      // 20 per minute
        delete: { maxRequests: 5, windowMs: 60000, identifier: 'delete' },       // 5 per minute
        list: { maxRequests: 60, windowMs: 60000, identifier: 'list' },          // 60 per minute
        command: { maxRequests: 30, windowMs: 60000, identifier: 'command' }     // 30 per minute
    };
    
    /**
     * Whitelisted WSL commands
     */
    private readonly whitelistedCommands = new Set([
        'list',
        'import',
        'export',
        'unregister',
        'terminate',
        'set-default'
    ]);
    
    /**
     * Get singleton instance
     */
    static getInstance(): SecurityValidator {
        if (!SecurityValidator.instance) {
            SecurityValidator.instance = new SecurityValidator();
        }
        return SecurityValidator.instance;
    }
    
    /**
     * Validate command execution with rate limiting
     * @param context Command context
     * @returns Security validation result
     */
    async validateCommand(context: CommandContext): Promise<SecurityValidationResult> {
        // Check command whitelist
        const commandType = this.getCommandType(context.command);
        if (!this.whitelistedCommands.has(commandType)) {
            return {
                allowed: false,
                reason: `Command '${commandType}' is not whitelisted`
            };
        }
        
        // Check rate limit
        const rateLimitResult = this.checkRateLimit(commandType);
        if (!rateLimitResult.allowed) {
            return rateLimitResult;
        }
        
        // Check for suspicious patterns
        const suspiciousResult = this.checkSuspiciousPatterns(context);
        if (!suspiciousResult.allowed) {
            return suspiciousResult;
        }
        
        // Log command for audit
        this.logCommand(context);
        
        return {
            allowed: true,
            remainingRequests: rateLimitResult.remainingRequests
        };
    }
    
    /**
     * Check rate limit for a command type
     * @param commandType Type of command
     * @returns Rate limit validation result
     */
    private checkRateLimit(commandType: string): SecurityValidationResult {
        const config = this.rateLimits[commandType] || this.rateLimits.command;
        const now = Date.now();
        const key = config.identifier;
        
        // Get or create rate limit entry
        let entry = this.rateLimitMap.get(key);
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 0,
                resetTime: now + config.windowMs
            };
            this.rateLimitMap.set(key, entry);
        }
        
        // Check if limit exceeded
        if (entry.count >= config.maxRequests) {
            return {
                allowed: false,
                reason: `Rate limit exceeded for ${commandType} operations`,
                remainingRequests: 0,
                resetTime: new Date(entry.resetTime)
            };
        }
        
        // Increment counter
        entry.count++;
        
        return {
            allowed: true,
            remainingRequests: config.maxRequests - entry.count
        };
    }
    
    /**
     * Check for suspicious command patterns
     * @param context Command context
     * @returns Validation result
     */
    private checkSuspiciousPatterns(context: CommandContext): SecurityValidationResult {
        // Check for repeated identical commands (potential automation attack)
        const recentIdentical = this.commandHistory
            .filter(cmd => 
                cmd.timestamp > Date.now() - 5000 && // Last 5 seconds
                cmd.command === context.command &&
                JSON.stringify(cmd.args) === JSON.stringify(context.args)
            );
        
        if (recentIdentical.length > 3) {
            return {
                allowed: false,
                reason: 'Suspicious pattern detected: repeated identical commands'
            };
        }
        
        // Check for rapid command execution
        const recentCommands = this.commandHistory
            .filter(cmd => cmd.timestamp > Date.now() - 1000); // Last second
        
        if (recentCommands.length > 5) {
            return {
                allowed: false,
                reason: 'Suspicious pattern detected: rapid command execution'
            };
        }
        
        // Check for unusual argument patterns
        for (const arg of context.args) {
            // Very long arguments might indicate buffer overflow attempts
            if (arg.length > 1000) {
                return {
                    allowed: false,
                    reason: 'Suspicious pattern detected: extremely long argument'
                };
            }
            
            // Check for encoded payloads
            if (this.looksLikeEncodedPayload(arg)) {
                return {
                    allowed: false,
                    reason: 'Suspicious pattern detected: potentially encoded payload'
                };
            }
        }
        
        return { allowed: true };
    }
    
    /**
     * Check if a string looks like an encoded payload
     * @param str String to check
     * @returns True if suspicious
     */
    private looksLikeEncodedPayload(str: string): boolean {
        // Check for base64 patterns
        if (/^[A-Za-z0-9+/]{20,}={0,2}$/.test(str)) {
            try {
                const decoded = Buffer.from(str, 'base64').toString();
                // Check if decoded contains shell commands
                if (/[;&|`$]/.test(decoded)) {
                    return true;
                }
            } catch {
                // Not valid base64, continue
            }
        }
        
        // Check for hex encoding
        if (/^[0-9a-fA-F]{40,}$/.test(str)) {
            return true;
        }
        
        // Check for URL encoding of suspicious characters
        if (/%[0-9a-fA-F]{2}/.test(str)) {
            const decoded = decodeURIComponent(str);
            if (/[;&|`$]/.test(decoded)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Get command type from command string
     * @param command Command string
     * @returns Command type
     */
    private getCommandType(command: string): string {
        // Extract the main command from WSL command
        if (command.includes('--list')) return 'list';
        if (command.includes('--import')) return 'import';
        if (command.includes('--export')) return 'export';
        if (command.includes('--unregister')) return 'delete';
        if (command.includes('--terminate')) return 'terminate';
        if (command.includes('--set-default')) return 'set-default';
        if (command.includes('-d') || command.includes('--distribution')) return 'command';
        
        return 'unknown';
    }
    
    /**
     * Log command for audit purposes
     * @param context Command context
     */
    private logCommand(context: CommandContext): void {
        // Add to history
        this.commandHistory.push({
            ...context,
            timestamp: Date.now()
        });
        
        // Trim history if too large
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory = this.commandHistory.slice(-this.maxHistorySize);
        }
        
        // Log to output channel if in debug mode
        if (vscode.workspace.getConfiguration('wsl-manager').get('enableSecurityLogging')) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                command: context.command,
                args: context.args,
                user: context.user || 'unknown'
            };
            
            console.log('[Security Audit]', JSON.stringify(logEntry));
        }
    }
    
    /**
     * Check if user has permission for an operation
     * @param operation Operation to check
     * @returns True if permitted
     */
    async checkPermission(operation: string): Promise<boolean> {
        // In VS Code extension context, we rely on workspace trust
        if (!vscode.workspace.isTrusted) {
            return false;
        }
        
        // Check workspace-specific permissions if configured
        const config = vscode.workspace.getConfiguration('wsl-manager');
        const restrictions = config.get<string[]>('restrictedOperations', []);
        
        if (restrictions.includes(operation)) {
            // Show permission dialog
            const choice = await vscode.window.showWarningMessage(
                `This operation (${operation}) requires additional confirmation. Continue?`,
                'Yes',
                'No'
            );
            
            return choice === 'Yes';
        }
        
        return true;
    }
    
    /**
     * Generate audit log entry
     * @param context Command context
     * @param result Execution result
     * @returns Audit log entry
     */
    generateAuditLog(context: CommandContext, result: any): string {
        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            command: context.command,
            args: context.args,
            user: context.user || 'vscode-user',
            success: result.success || false,
            error: result.error || null
        };
        
        return JSON.stringify(entry);
    }
    
    /**
     * Reset rate limits (for testing)
     */
    resetRateLimits(): void {
        this.rateLimitMap.clear();
    }
    
    /**
     * Get current rate limit status
     * @returns Rate limit status for all command types
     */
    getRateLimitStatus(): { [key: string]: { remaining: number; resetTime: Date } } {
        const status: { [key: string]: { remaining: number; resetTime: Date } } = {};
        const now = Date.now();
        
        for (const [key, config] of Object.entries(this.rateLimits)) {
            const entry = this.rateLimitMap.get(config.identifier);
            
            if (!entry || now > entry.resetTime) {
                status[key] = {
                    remaining: config.maxRequests,
                    resetTime: new Date(now + config.windowMs)
                };
            } else {
                status[key] = {
                    remaining: Math.max(0, config.maxRequests - entry.count),
                    resetTime: new Date(entry.resetTime)
                };
            }
        }
        
        return status;
    }
}