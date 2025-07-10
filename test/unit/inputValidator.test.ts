/**
 * Unit tests for InputValidator
 * Tests comprehensive input validation and sanitization
 */

import { InputValidator, ValidationResult } from '../../src/utils/inputValidator';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

describe('InputValidator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Set up default fs mocks
        (fs.statSync as jest.Mock).mockReturnValue({
            isFile: () => true,
            isDirectory: () => false
        });
        (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    });
    
    describe('validateDistributionName', () => {
        it('should accept valid distribution names', () => {
            const validNames = [
                'ubuntu',
                'Ubuntu-20.04',
                'debian_test',
                'alpine.linux',
                'my-custom-wsl',
                'WSL2_Dev',
                'test123',
                'a', // Single character
                'a'.repeat(64) // Max length
            ];
            
            validNames.forEach(name => {
                const result = InputValidator.validateDistributionName(name);
                expect(result.isValid).toBe(true);
                expect(result.sanitizedValue).toBe(name.trim());
                expect(result.error).toBeUndefined();
            });
        });
        
        it('should reject invalid distribution names', () => {
            const invalidNames = [
                { name: '', error: 'Distribution name is required' },
                { name: '   ', error: 'Distribution name is too short' },
                { name: 'test@distro', error: 'can only contain' },
                { name: 'test distro', error: 'can only contain' },
                { name: 'test/distro', error: 'can only contain' },
                { name: 'test\\distro', error: 'can only contain' },
                { name: 'test:distro', error: 'can only contain' },
                { name: 'test;distro', error: 'can only contain' },
                { name: 'test|distro', error: 'can only contain' },
                { name: 'test>distro', error: 'can only contain' },
                { name: 'test<distro', error: 'can only contain' },
                { name: 'test"distro', error: 'can only contain' },
                { name: 'test\'distro', error: 'can only contain' },
                { name: 'a'.repeat(65), error: 'must not exceed 64 characters' }
            ];
            
            invalidNames.forEach(({ name, error }) => {
                const result = InputValidator.validateDistributionName(name);
                expect(result.isValid).toBe(false);
                expect(result.error).toContain(error);
                expect(result.sanitizedValue).toBeUndefined();
            });
        });
        
        it('should reject reserved names', () => {
            const reservedNames = ['wsl', 'windows', 'system', 'root', 'admin'];
            
            reservedNames.forEach(name => {
                const result = InputValidator.validateDistributionName(name);
                expect(result.isValid).toBe(false);
                expect(result.error).toContain('reserved');
                
                // Also check case variations
                const upperResult = InputValidator.validateDistributionName(name.toUpperCase());
                expect(upperResult.isValid).toBe(false);
            });
        });
        
        it('should handle null and undefined inputs', () => {
            const nullResult = InputValidator.validateDistributionName(null as any);
            expect(nullResult.isValid).toBe(false);
            expect(nullResult.error).toContain('required');
            
            const undefinedResult = InputValidator.validateDistributionName(undefined as any);
            expect(undefinedResult.isValid).toBe(false);
            expect(undefinedResult.error).toContain('required');
        });
        
        it('should trim whitespace', () => {
            const result = InputValidator.validateDistributionName('  test-distro  ');
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe('test-distro');
        });
    });
    
    describe('validateFilePath', () => {
        it('should accept valid file paths', () => {
            const validPaths = [
                '/home/user/file.tar',
                'C:\\Users\\Test\\file.tar',
                './relative/path/file.tar',
                '../parent/file.tar',
                'file.tar'
            ];
            
            validPaths.forEach(filePath => {
                const result = InputValidator.validateFilePath(filePath);
                expect(result.isValid).toBe(true);
                expect(result.sanitizedValue).toBe(path.normalize(filePath.trim()));
            });
        });
        
        it('should reject dangerous path patterns', () => {
            const dangerousPaths = [
                '../../etc/passwd',
                '~/sensitive/file',
                '${HOME}/file.tar',
                '$(pwd)/file.tar',
                '`whoami`.tar',
                'file;rm -rf /',
                'file|cat',
                'file>output',
                'file<input',
                'file\x00.tar'
            ];
            
            dangerousPaths.forEach(filePath => {
                const result = InputValidator.validateFilePath(filePath);
                expect(result.isValid).toBe(false);
                expect(result.error).toContain('invalid characters or patterns');
            });
        });
        
        it('should validate file extensions when specified', () => {
            const options = { allowedExtensions: ['.tar', '.gz'] };
            
            const validResult = InputValidator.validateFilePath('file.tar', options);
            expect(validResult.isValid).toBe(true);
            
            const invalidResult = InputValidator.validateFilePath('file.zip', options);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.error).toContain('File extension must be one of');
            
            // Should handle extensions without dots
            const optionsNoDot = { allowedExtensions: ['tar', 'gz'] };
            const result = InputValidator.validateFilePath('file.tar', optionsNoDot);
            expect(result.isValid).toBe(true);
        });
        
        it('should check file existence when required', () => {
            const options = { mustExist: true };
            
            // File exists
            (fs.statSync as jest.Mock).mockReturnValue({
                isFile: () => true,
                isDirectory: () => false
            });
            
            const existsResult = InputValidator.validateFilePath('existing.tar', options);
            expect(existsResult.isValid).toBe(true);
            
            // File doesn't exist
            (fs.statSync as jest.Mock).mockImplementation(() => {
                throw new Error('ENOENT');
            });
            
            const notExistsResult = InputValidator.validateFilePath('missing.tar', options);
            expect(notExistsResult.isValid).toBe(false);
            expect(notExistsResult.error).toContain('does not exist');
            
            // Path exists but is directory
            (fs.statSync as jest.Mock).mockReturnValue({
                isFile: () => false,
                isDirectory: () => true
            });
            
            const dirResult = InputValidator.validateFilePath('directory', options);
            expect(dirResult.isValid).toBe(false);
            expect(dirResult.error).toContain('not a file');
        });
        
        it('should validate paths within base path', () => {
            const options = { basePath: '/allowed/path' };
            
            // Valid path within base
            const validResult = InputValidator.validateFilePath('subdir/file.tar', options);
            expect(validResult.isValid).toBe(true);
            
            // Path traversal attempt
            const traversalResult = InputValidator.validateFilePath('../../../etc/passwd', options);
            expect(traversalResult.isValid).toBe(false);
            expect(traversalResult.error).toContain('Path traversal detected');
        });
        
        it('should handle empty and invalid inputs', () => {
            expect(InputValidator.validateFilePath('').isValid).toBe(false);
            expect(InputValidator.validateFilePath('   ').isValid).toBe(false);
            expect(InputValidator.validateFilePath(null as any).isValid).toBe(false);
            expect(InputValidator.validateFilePath(undefined as any).isValid).toBe(false);
        });
    });
    
    describe('validateDirectoryPath', () => {
        it('should accept valid directory paths', () => {
            (fs.statSync as jest.Mock).mockReturnValue({
                isFile: () => false,
                isDirectory: () => true
            });
            
            const result = InputValidator.validateDirectoryPath('/valid/directory');
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe(path.normalize('/valid/directory'));
        });
        
        it('should create directory if requested', () => {
            (fs.statSync as jest.Mock).mockImplementation(() => {
                throw new Error('ENOENT');
            });
            
            const options = { createIfNotExists: true };
            const result = InputValidator.validateDirectoryPath('/new/directory', options);
            
            expect(result.isValid).toBe(true);
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                path.normalize('/new/directory'),
                { recursive: true }
            );
        });
        
        it('should fail if directory must exist but does not', () => {
            (fs.statSync as jest.Mock).mockImplementation(() => {
                throw new Error('ENOENT');
            });
            
            const options = { mustExist: true };
            const result = InputValidator.validateDirectoryPath('/missing/directory', options);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('does not exist');
        });
        
        it('should fail if path exists but is not directory', () => {
            (fs.statSync as jest.Mock).mockReturnValue({
                isFile: () => true,
                isDirectory: () => false
            });
            
            const result = InputValidator.validateDirectoryPath('/path/to/file');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('not a directory');
        });
        
        it('should handle directory creation failure', () => {
            (fs.statSync as jest.Mock).mockImplementation(() => {
                throw new Error('ENOENT');
            });
            (fs.mkdirSync as jest.Mock).mockImplementation(() => {
                throw new Error('Permission denied');
            });
            
            const options = { createIfNotExists: true };
            const result = InputValidator.validateDirectoryPath('/protected/directory', options);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Failed to create directory');
        });
    });
    
    describe('validateCommandParameters', () => {
        it('should accept valid command parameters', () => {
            const validParams = [
                ['ls', '-la'],
                ['echo', 'hello world'],
                ['cat', '/etc/hosts'],
                ['grep', 'pattern', 'file.txt']
            ];
            
            validParams.forEach(params => {
                const result = InputValidator.validateCommandParameters(params);
                expect(result.isValid).toBe(true);
                expect(result.sanitizedValue).toBe(params.join(' '));
            });
        });
        
        it('should reject dangerous command parameters', () => {
            const dangerousParams = [
                ['rm', '-rf', '/'],
                ['echo', 'test;', 'rm -rf /'],
                ['cat', '|', 'sh'],
                ['echo', '`whoami`'],
                ['test', '$(pwd)'],
                ['cmd', '${HOME}'],
                ['test', 'param1&&param2'],
                ['test', 'param1||param2'],
                ['test', 'param>output'],
                ['test', 'param<input'],
                ['test', 'param\necho hacked'],
                ['test', 'param\r\necho hacked']
            ];
            
            dangerousParams.forEach(params => {
                const result = InputValidator.validateCommandParameters(params);
                expect(result.isValid).toBe(false);
                expect(result.error).toContain('dangerous characters');
            });
        });
        
        it('should validate parameter types', () => {
            const invalidParams = [
                'not an array',
                123,
                null,
                undefined,
                ['valid', 123, 'param'],
                ['valid', null, 'param'],
                ['valid', undefined, 'param'],
                ['valid', {}, 'param']
            ];
            
            invalidParams.forEach(params => {
                const result = InputValidator.validateCommandParameters(params as any);
                expect(result.isValid).toBe(false);
            });
        });
    });
    
    describe('sanitizeForDisplay', () => {
        it('should remove control characters', () => {
            const input = 'Hello\x00World\x1F\x7FTest';
            const result = InputValidator.sanitizeForDisplay(input);
            expect(result).toBe('HelloWorldTest');
        });
        
        it('should truncate long strings', () => {
            const longString = 'a'.repeat(150);
            const result = InputValidator.sanitizeForDisplay(longString, 50);
            expect(result).toBe('a'.repeat(47) + '...');
            expect(result.length).toBe(50);
        });
        
        it('should handle empty and invalid inputs', () => {
            expect(InputValidator.sanitizeForDisplay('')).toBe('');
            expect(InputValidator.sanitizeForDisplay(null as any)).toBe('');
            expect(InputValidator.sanitizeForDisplay(undefined as any)).toBe('');
            expect(InputValidator.sanitizeForDisplay(123 as any)).toBe('');
        });
        
        it('should preserve normal characters', () => {
            const input = 'Normal text with spaces, punctuation! And numbers 123.';
            const result = InputValidator.sanitizeForDisplay(input);
            expect(result).toBe(input);
        });
    });
    
    describe('validateCommandInputs', () => {
        it('should validate multiple inputs at once', () => {
            const inputs = {
                distributionName: 'test-distro',
                filePath: '/path/to/file.tar',
                directoryPath: '/install/path',
                parameters: ['ls', '-la']
            };
            
            (fs.statSync as jest.Mock).mockReturnValue({
                isFile: () => true,
                isDirectory: () => true
            });
            
            const results = InputValidator.validateCommandInputs(inputs);
            
            expect(results.distributionName.isValid).toBe(true);
            expect(results.filePath.isValid).toBe(true);
            expect(results.directoryPath.isValid).toBe(true);
            expect(results.parameters.isValid).toBe(true);
            
            expect(InputValidator.allValid(results)).toBe(true);
        });
        
        it('should handle partial inputs', () => {
            const inputs = {
                distributionName: 'valid-name'
                // Other fields undefined
            };
            
            const results = InputValidator.validateCommandInputs(inputs);
            
            expect(results.distributionName).toBeDefined();
            expect(results.filePath).toBeUndefined();
            expect(results.directoryPath).toBeUndefined();
            expect(results.parameters).toBeUndefined();
        });
        
        it('should detect invalid inputs in batch', () => {
            const inputs = {
                distributionName: 'invalid@name',
                filePath: '../../etc/passwd',
                parameters: ['rm', '-rf', '/']
            };
            
            const results = InputValidator.validateCommandInputs(inputs);
            
            expect(results.distributionName.isValid).toBe(false);
            expect(results.filePath.isValid).toBe(false);
            expect(results.parameters.isValid).toBe(false);
            
            expect(InputValidator.allValid(results)).toBe(false);
        });
    });
    
    describe('Edge cases and security scenarios', () => {
        it('should handle Unicode and special characters', () => {
            const unicodeName = 'test-κόσμε-世界';
            const nameResult = InputValidator.validateDistributionName(unicodeName);
            expect(nameResult.isValid).toBe(false); // Non-ASCII not allowed
            
            const unicodePath = '/path/to/файл.tar';
            const pathResult = InputValidator.validateFilePath(unicodePath);
            expect(pathResult.isValid).toBe(true); // Paths can contain Unicode
        });
        
        it('should prevent various injection attempts', () => {
            const injectionAttempts = [
                '"; echo "hacked',
                '\' && echo \'hacked',
                '`echo hacked`',
                '$(echo hacked)',
                '${IFS}',
                '\x00command',
                'test\u0000injection'
            ];
            
            injectionAttempts.forEach(attempt => {
                const nameResult = InputValidator.validateDistributionName(attempt);
                expect(nameResult.isValid).toBe(false);
                
                const pathResult = InputValidator.validateFilePath(attempt);
                expect(pathResult.isValid).toBe(false);
            });
        });
        
        it('should handle Windows vs Unix path separators', () => {
            const windowsPath = 'C:\\Users\\Test\\file.tar';
            const unixPath = '/home/user/file.tar';
            
            const winResult = InputValidator.validateFilePath(windowsPath);
            const unixResult = InputValidator.validateFilePath(unixPath);
            
            expect(winResult.isValid).toBe(true);
            expect(unixResult.isValid).toBe(true);
            
            // Both should be normalized to platform-specific format
            expect(winResult.sanitizedValue).toBe(path.normalize(windowsPath));
            expect(unixResult.sanitizedValue).toBe(path.normalize(unixPath));
        });
    });
});