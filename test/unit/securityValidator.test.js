"use strict";
/**
 * Unit tests for SecurityValidator
 * Tests rate limiting, command validation, and security features
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
const securityValidator_1 = require("../../src/security/securityValidator");
const vscode = __importStar(require("vscode"));
// Mock vscode
jest.mock('vscode');
describe('SecurityValidator', () => {
    let securityValidator;
    beforeEach(() => {
        // Get fresh instance
        securityValidator = securityValidator_1.SecurityValidator.getInstance();
        securityValidator.resetRateLimits();
        // Mock vscode workspace
        vscode.workspace.isTrusted = true;
        vscode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue([])
        });
        // Mock window for permission prompts
        vscode.window.showWarningMessage.mockResolvedValue('Yes');
        // Clear console mocks
        jest.clearAllMocks();
    });
    describe('Singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = securityValidator_1.SecurityValidator.getInstance();
            const instance2 = securityValidator_1.SecurityValidator.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe('Command validation', () => {
        it('should allow whitelisted commands', async () => {
            const whitelistedCommands = [
                { command: 'list', args: ['--list'] },
                { command: 'import', args: ['--import', 'test', '/path'] },
                { command: 'export', args: ['--export', 'test', '/path'] },
                { command: 'delete', args: ['--unregister', 'test'] },
                { command: 'terminate', args: ['--terminate', 'test'] },
                { command: 'set-default', args: ['--set-default', 'test'] }
            ];
            for (const cmd of whitelistedCommands) {
                const context = {
                    command: cmd.command,
                    args: cmd.args,
                    timestamp: Date.now()
                };
                const result = await securityValidator.validateCommand(context);
                expect(result.allowed).toBe(true);
                expect(result.reason).toBeUndefined();
            }
        });
        it('should reject non-whitelisted commands', async () => {
            const context = {
                command: 'dangerous-command',
                args: ['--dangerous'],
                timestamp: Date.now()
            };
            const result = await securityValidator.validateCommand(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not whitelisted');
        });
    });
    describe('Rate limiting', () => {
        it('should enforce rate limits per command type', async () => {
            // Test create command limit (10 per minute)
            const createContext = {
                command: 'create',
                args: ['create', 'test'],
                timestamp: Date.now()
            };
            // Execute up to the limit
            for (let i = 0; i < 10; i++) {
                const result = await securityValidator.validateCommand(createContext);
                expect(result.allowed).toBe(true);
                expect(result.remainingRequests).toBe(9 - i);
            }
            // Next request should be blocked
            const blockedResult = await securityValidator.validateCommand(createContext);
            expect(blockedResult.allowed).toBe(false);
            expect(blockedResult.reason).toContain('Rate limit exceeded');
            expect(blockedResult.remainingRequests).toBe(0);
            expect(blockedResult.resetTime).toBeInstanceOf(Date);
        });
        it('should have different limits for different operations', async () => {
            const operations = [
                { command: 'create', limit: 10 },
                { command: 'import', limit: 5 },
                { command: 'export', limit: 20 },
                { command: 'delete', limit: 5 },
                { command: 'list', limit: 60 }
            ];
            for (const op of operations) {
                securityValidator.resetRateLimits();
                const context = {
                    command: op.command,
                    args: [op.command],
                    timestamp: Date.now()
                };
                // Execute up to limit
                let lastResult = { allowed: true };
                for (let i = 0; i < op.limit; i++) {
                    lastResult = await securityValidator.validateCommand(context);
                    expect(lastResult.allowed).toBe(true);
                }
                // Verify we're at the limit
                expect(lastResult.remainingRequests).toBe(0);
                // Next should fail
                const blocked = await securityValidator.validateCommand(context);
                expect(blocked.allowed).toBe(false);
            }
        });
        it('should reset rate limits after time window', async () => {
            jest.useFakeTimers();
            const context = {
                command: 'import',
                args: ['--import'],
                timestamp: Date.now()
            };
            // Use up the limit
            for (let i = 0; i < 5; i++) {
                await securityValidator.validateCommand(context);
            }
            // Should be blocked
            let result = await securityValidator.validateCommand(context);
            expect(result.allowed).toBe(false);
            // Advance time by 1 minute
            jest.advanceTimersByTime(60001);
            // Should be allowed again
            result = await securityValidator.validateCommand({
                ...context,
                timestamp: Date.now()
            });
            expect(result.allowed).toBe(true);
            jest.useRealTimers();
        });
    });
    describe('Suspicious pattern detection', () => {
        it('should detect repeated identical commands', async () => {
            const context = {
                command: 'list',
                args: ['--list', '--verbose'],
                timestamp: Date.now()
            };
            // First 3 identical commands are OK
            for (let i = 0; i < 3; i++) {
                const result = await securityValidator.validateCommand(context);
                expect(result.allowed).toBe(true);
            }
            // 4th identical command within 5 seconds should be blocked
            const result = await securityValidator.validateCommand(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('repeated identical commands');
        });
        it('should detect rapid command execution', async () => {
            // Execute many different commands rapidly
            for (let i = 0; i < 5; i++) {
                const context = {
                    command: 'list',
                    args: ['--list', `arg${i}`],
                    timestamp: Date.now()
                };
                const result = await securityValidator.validateCommand(context);
                expect(result.allowed).toBe(true);
            }
            // 6th command in rapid succession should be blocked
            const context = {
                command: 'list',
                args: ['--list', 'arg6'],
                timestamp: Date.now()
            };
            const result = await securityValidator.validateCommand(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('rapid command execution');
        });
        it('should detect extremely long arguments', async () => {
            const longArg = 'a'.repeat(1001);
            const context = {
                command: 'list',
                args: ['--list', longArg],
                timestamp: Date.now()
            };
            const result = await securityValidator.validateCommand(context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('extremely long argument');
        });
        it('should detect encoded payloads', async () => {
            const encodedPayloads = [
                // Base64 encoded shell command
                Buffer.from('rm -rf /').toString('base64'),
                // Hex encoded payload
                '726d202d7266202f',
                // URL encoded dangerous characters
                'test%3B%20rm%20-rf%20%2F'
            ];
            for (const payload of encodedPayloads) {
                const context = {
                    command: 'list',
                    args: ['--list', payload],
                    timestamp: Date.now()
                };
                const result = await securityValidator.validateCommand(context);
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('encoded payload');
            }
        });
        it('should allow normal base64 that is not malicious', async () => {
            const safeBase64 = Buffer.from('Hello World').toString('base64');
            const context = {
                command: 'list',
                args: ['--list', safeBase64],
                timestamp: Date.now()
            };
            const result = await securityValidator.validateCommand(context);
            expect(result.allowed).toBe(true);
        });
    });
    describe('Permission checks', () => {
        it('should check workspace trust', async () => {
            vscode.workspace.isTrusted = false;
            const result = await securityValidator.checkPermission('delete');
            expect(result).toBe(false);
        });
        it('should prompt for restricted operations', async () => {
            vscode.workspace.getConfiguration.mockReturnValue({
                get: jest.fn().mockReturnValue(['delete', 'create'])
            });
            vscode.window.showWarningMessage.mockResolvedValue('Yes');
            const result = await securityValidator.checkPermission('delete');
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('delete'), 'Yes', 'No');
            expect(result).toBe(true);
        });
        it('should deny permission when user cancels', async () => {
            vscode.workspace.getConfiguration.mockReturnValue({
                get: jest.fn().mockReturnValue(['delete'])
            });
            vscode.window.showWarningMessage.mockResolvedValue('No');
            const result = await securityValidator.checkPermission('delete');
            expect(result).toBe(false);
        });
        it('should allow unrestricted operations', async () => {
            vscode.workspace.getConfiguration.mockReturnValue({
                get: jest.fn().mockReturnValue(['delete']) // Only delete is restricted
            });
            const result = await securityValidator.checkPermission('list');
            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
    describe('Audit logging', () => {
        it('should generate audit log entries', () => {
            const context = {
                command: 'create',
                args: ['create', 'test-distro'],
                user: 'testuser',
                timestamp: Date.now()
            };
            const result = { success: true };
            const auditLog = securityValidator.generateAuditLog(context, result);
            const parsed = JSON.parse(auditLog);
            expect(parsed).toHaveProperty('id');
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed.command).toBe('create');
            expect(parsed.args).toEqual(['create', 'test-distro']);
            expect(parsed.user).toBe('testuser');
            expect(parsed.success).toBe(true);
            expect(parsed.error).toBe(null);
        });
        it('should handle error results in audit log', () => {
            const context = {
                command: 'import',
                args: ['--import'],
                timestamp: Date.now()
            };
            const result = { success: false, error: 'Permission denied' };
            const auditLog = securityValidator.generateAuditLog(context, result);
            const parsed = JSON.parse(auditLog);
            expect(parsed.success).toBe(false);
            expect(parsed.error).toBe('Permission denied');
            expect(parsed.user).toBe('vscode-user'); // Default when not specified
        });
        it('should log commands when security logging is enabled', async () => {
            vscode.workspace.getConfiguration.mockReturnValue({
                get: jest.fn((key) => key === 'enableSecurityLogging' ? true : [])
            });
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const context = {
                command: 'list',
                args: ['--list'],
                timestamp: Date.now()
            };
            await securityValidator.validateCommand(context);
            expect(consoleSpy).toHaveBeenCalledWith('[Security Audit]', expect.stringContaining('"command":"list"'));
            consoleSpy.mockRestore();
        });
    });
    describe('Rate limit status', () => {
        it('should report current rate limit status', async () => {
            // Use some requests
            await securityValidator.validateCommand({
                command: 'create',
                args: ['create'],
                timestamp: Date.now()
            });
            await securityValidator.validateCommand({
                command: 'create',
                args: ['create'],
                timestamp: Date.now()
            });
            const status = securityValidator.getRateLimitStatus();
            expect(status.create.remaining).toBe(8); // 10 - 2
            expect(status.create.resetTime).toBeInstanceOf(Date);
            expect(status.import.remaining).toBe(5); // Unused
            expect(status.list.remaining).toBe(60); // Unused
        });
    });
    describe('Command type detection', () => {
        it('should correctly identify command types', async () => {
            const commandMappings = [
                { args: ['--list'], expectedType: 'list' },
                { args: ['--import', 'name', 'path'], expectedType: 'import' },
                { args: ['--export', 'name', 'path'], expectedType: 'export' },
                { args: ['--unregister', 'name'], expectedType: 'delete' },
                { args: ['--terminate', 'name'], expectedType: 'terminate' },
                { args: ['--set-default', 'name'], expectedType: 'set-default' },
                { args: ['-d', 'distro', 'command'], expectedType: 'command' }
            ];
            for (const mapping of commandMappings) {
                const context = {
                    command: mapping.args.join(' '),
                    args: mapping.args,
                    timestamp: Date.now()
                };
                // We can infer the type from the rate limit status after validation
                await securityValidator.validateCommand(context);
                const status = securityValidator.getRateLimitStatus();
                // Check that the correct rate limit was decremented
                if (mapping.expectedType === 'delete') {
                    expect(status.delete.remaining).toBeLessThan(5);
                }
                else if (mapping.expectedType === 'command') {
                    expect(status.command.remaining).toBeLessThan(30);
                }
            }
        });
    });
    describe('Edge cases', () => {
        it('should handle very rapid sequential commands with timestamps', async () => {
            // Simulate commands with same timestamp
            const timestamp = Date.now();
            for (let i = 0; i < 10; i++) {
                const context = {
                    command: 'list',
                    args: ['--list', `${i}`],
                    timestamp // Same timestamp
                };
                await securityValidator.validateCommand(context);
            }
            // Should trigger rapid execution detection
            const status = securityValidator.getRateLimitStatus();
            expect(status.list.remaining).toBeGreaterThan(0); // Rate limit not exhausted
        });
        it('should handle command history overflow', async () => {
            // Fill command history beyond max size (1000)
            for (let i = 0; i < 1100; i++) {
                const context = {
                    command: 'list',
                    args: ['--list', `${i}`],
                    timestamp: Date.now() - (i * 1000) // Spread out timestamps
                };
                // Reset rate limits periodically to allow continued execution
                if (i % 50 === 0) {
                    securityValidator.resetRateLimits();
                }
                await securityValidator.validateCommand(context);
            }
            // Should still function correctly
            const context = {
                command: 'list',
                args: ['--list', 'final'],
                timestamp: Date.now()
            };
            const result = await securityValidator.validateCommand(context);
            expect(result.allowed).toBeDefined();
        });
    });
});
//# sourceMappingURL=securityValidator.test.js.map