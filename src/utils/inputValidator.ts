/**
 * InputValidator utility for validating and sanitizing user inputs
 * Prevents injection attacks and ensures data integrity
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Validation result with details
 */
export interface ValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedValue?: string;
}

/**
 * Input validation utility class
 */
export class InputValidator {
    /**
     * Regular expression for valid distribution names
     * Allows alphanumeric characters, dashes, underscores, and dots
     */
    private static readonly DISTRIBUTION_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
    
    /**
     * Maximum length for distribution names
     */
    private static readonly MAX_DISTRIBUTION_NAME_LENGTH = 64;
    
    /**
     * Minimum length for distribution names
     */
    private static readonly MIN_DISTRIBUTION_NAME_LENGTH = 1;
    
    /**
     * Dangerous path patterns to detect
     */
    private static readonly DANGEROUS_PATH_PATTERNS = [
        /\.\./,              // Parent directory traversal
        /^~/,                // Home directory expansion
        /\$\{.*\}/,          // Variable expansion
        /\$\(.*\)/,          // Command substitution
        /`.*`/,              // Command substitution
        /[;&|<>]/,           // Shell operators
        /\x00/               // Null bytes
    ];
    
    /**
     * Validate a distribution name
     * @param name Distribution name to validate
     * @returns Validation result
     */
    static validateDistributionName(name: string): ValidationResult {
        // Check if name is provided
        if (!name || typeof name !== 'string') {
            return {
                isValid: false,
                error: 'Distribution name is required'
            };
        }
        
        // Trim whitespace
        const trimmedName = name.trim();
        
        // Check length
        if (trimmedName.length < this.MIN_DISTRIBUTION_NAME_LENGTH) {
            return {
                isValid: false,
                error: 'Distribution name is too short'
            };
        }
        
        if (trimmedName.length > this.MAX_DISTRIBUTION_NAME_LENGTH) {
            return {
                isValid: false,
                error: `Distribution name must not exceed ${this.MAX_DISTRIBUTION_NAME_LENGTH} characters`
            };
        }
        
        // Check pattern
        if (!this.DISTRIBUTION_NAME_PATTERN.test(trimmedName)) {
            return {
                isValid: false,
                error: 'Distribution name can only contain letters, numbers, dots, dashes, and underscores'
            };
        }
        
        // Check for reserved names
        const reservedNames = ['wsl', 'windows', 'system', 'root', 'admin'];
        if (reservedNames.includes(trimmedName.toLowerCase())) {
            return {
                isValid: false,
                error: 'Distribution name is reserved'
            };
        }
        
        return {
            isValid: true,
            sanitizedValue: trimmedName
        };
    }
    
    /**
     * Validate a file path
     * @param filePath Path to validate
     * @param options Validation options
     * @returns Validation result
     */
    static validateFilePath(
        filePath: string,
        options: {
            mustExist?: boolean;
            allowedExtensions?: string[];
            basePath?: string;
        } = {}
    ): ValidationResult {
        // Check if path is provided
        if (!filePath || typeof filePath !== 'string') {
            return {
                isValid: false,
                error: 'File path is required'
            };
        }
        
        // Trim whitespace
        const trimmedPath = filePath.trim();
        
        // Check for empty path
        if (trimmedPath.length === 0) {
            return {
                isValid: false,
                error: 'File path cannot be empty'
            };
        }
        
        // Check for dangerous patterns
        for (const pattern of this.DANGEROUS_PATH_PATTERNS) {
            if (pattern.test(trimmedPath)) {
                return {
                    isValid: false,
                    error: 'File path contains invalid characters or patterns'
                };
            }
        }
        
        // Normalize the path
        const normalizedPath = path.normalize(trimmedPath);
        
        // If base path is provided, ensure the path is within it
        if (options.basePath) {
            const resolvedPath = path.resolve(options.basePath, normalizedPath);
            const resolvedBase = path.resolve(options.basePath);
            
            if (!resolvedPath.startsWith(resolvedBase)) {
                return {
                    isValid: false,
                    error: 'Path traversal detected'
                };
            }
        }
        
        // Check file extension if specified
        if (options.allowedExtensions && options.allowedExtensions.length > 0) {
            const ext = path.extname(normalizedPath).toLowerCase();
            const allowedExts = options.allowedExtensions.map(e => 
                e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`
            );
            
            if (!allowedExts.includes(ext)) {
                return {
                    isValid: false,
                    error: `File extension must be one of: ${allowedExts.join(', ')}`
                };
            }
        }
        
        // Check if file exists if required
        if (options.mustExist) {
            try {
                const stats = fs.statSync(normalizedPath);
                if (!stats.isFile()) {
                    return {
                        isValid: false,
                        error: 'Path exists but is not a file'
                    };
                }
            } catch (error) {
                return {
                    isValid: false,
                    error: 'File does not exist'
                };
            }
        }
        
        return {
            isValid: true,
            sanitizedValue: normalizedPath
        };
    }
    
    /**
     * Validate a directory path
     * @param dirPath Directory path to validate
     * @param options Validation options
     * @returns Validation result
     */
    static validateDirectoryPath(
        dirPath: string,
        options: {
            mustExist?: boolean;
            createIfNotExists?: boolean;
            basePath?: string;
        } = {}
    ): ValidationResult {
        // Use file path validation for basic checks
        const basicValidation = this.validateFilePath(dirPath, {
            mustExist: false,
            basePath: options.basePath
        });
        
        if (!basicValidation.isValid) {
            return basicValidation;
        }
        
        const normalizedPath = basicValidation.sanitizedValue!;
        
        // Check if directory exists
        try {
            const stats = fs.statSync(normalizedPath);
            if (!stats.isDirectory()) {
                return {
                    isValid: false,
                    error: 'Path exists but is not a directory'
                };
            }
        } catch (error) {
            if (options.mustExist) {
                return {
                    isValid: false,
                    error: 'Directory does not exist'
                };
            }
            
            // Optionally create directory
            if (options.createIfNotExists) {
                try {
                    fs.mkdirSync(normalizedPath, { recursive: true });
                } catch (createError) {
                    return {
                        isValid: false,
                        error: 'Failed to create directory'
                    };
                }
            }
        }
        
        return {
            isValid: true,
            sanitizedValue: normalizedPath
        };
    }
    
    /**
     * Validate command parameters
     * @param params Parameters to validate
     * @returns Validation result
     */
    static validateCommandParameters(params: string[]): ValidationResult {
        if (!Array.isArray(params)) {
            return {
                isValid: false,
                error: 'Parameters must be an array'
            };
        }
        
        // Check each parameter
        const dangerousChars = /[;&|`$(){}[\]<>\\n\\r]/;
        for (let i = 0; i < params.length; i++) {
            const param = params[i];
            
            if (typeof param !== 'string') {
                return {
                    isValid: false,
                    error: `Parameter at index ${i} is not a string`
                };
            }
            
            if (dangerousChars.test(param)) {
                return {
                    isValid: false,
                    error: `Parameter at index ${i} contains potentially dangerous characters`
                };
            }
        }
        
        return {
            isValid: true,
            sanitizedValue: params.join(' ')
        };
    }
    
    /**
     * Sanitize a string for safe display
     * @param input Input string
     * @param maxLength Maximum length
     * @returns Sanitized string
     */
    static sanitizeForDisplay(input: string, maxLength = 100): string {
        if (!input || typeof input !== 'string') {
            return '';
        }
        
        // Remove control characters
        let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
        
        // Truncate if needed
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength - 3) + '...';
        }
        
        return sanitized;
    }
    
    /**
     * Validate all inputs for a command
     * @param inputs Object containing various inputs
     * @returns Validation results for each input
     */
    static validateCommandInputs(inputs: {
        distributionName?: string;
        filePath?: string;
        directoryPath?: string;
        parameters?: string[];
    }): { [key: string]: ValidationResult } {
        const results: { [key: string]: ValidationResult } = {};
        
        if (inputs.distributionName !== undefined) {
            results.distributionName = this.validateDistributionName(inputs.distributionName);
        }
        
        if (inputs.filePath !== undefined) {
            results.filePath = this.validateFilePath(inputs.filePath);
        }
        
        if (inputs.directoryPath !== undefined) {
            results.directoryPath = this.validateDirectoryPath(inputs.directoryPath);
        }
        
        if (inputs.parameters !== undefined) {
            results.parameters = this.validateCommandParameters(inputs.parameters);
        }
        
        return results;
    }
    
    /**
     * Check if all validation results are valid
     * @param results Validation results to check
     * @returns True if all are valid
     */
    static allValid(results: { [key: string]: ValidationResult }): boolean {
        return Object.values(results).every(result => result.isValid);
    }

    /**
     * Validate a command string
     * @param command Command to validate
     * @returns Validation result
     */
    static validateCommand(command: string): ValidationResult {
        if (!command || typeof command !== 'string') {
            return {
                isValid: false,
                error: 'Command cannot be empty'
            };
        }

        const trimmedCommand = command.trim();

        if (trimmedCommand.length === 0) {
            return {
                isValid: false,
                error: 'Command cannot be empty'
            };
        }

        // Check for command chaining
        if (trimmedCommand.includes('&&') || trimmedCommand.includes('||')) {
            return {
                isValid: false,
                error: 'Command chaining is not allowed'
            };
        }

        // Check for dangerous characters
        const dangerousChars = /[;&|<>`$(){}[\]]/;
        if (dangerousChars.test(trimmedCommand)) {
            return {
                isValid: false,
                error: 'Command contains dangerous characters'
            };
        }

        return {
            isValid: true,
            sanitizedValue: trimmedCommand
        };
    }

    /**
     * Sanitize input string by removing dangerous characters
     * @param input Input to sanitize
     * @returns Sanitized string
     */
    static sanitizeInput(input: string): string {
        if (!input || typeof input !== 'string') {
            return '';
        }

        // Remove control characters and trim
        return input
            .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
            .trim();
    }

    /**
     * Check if a path is valid for Windows
     * @param path Path to validate
     * @returns True if valid Windows path
     */
    static isValidWindowsPath(path: string): boolean {
        if (!path || typeof path !== 'string') {
            return false;
        }

        // Windows path pattern (drive letter or UNC)
        const windowsPathPattern = /^([a-zA-Z]:[\\/]|\\\\)/;

        // Check for invalid characters in Windows paths
        const invalidChars = /[<>:"|?*]/;
        const pathWithoutDrive = path.replace(/^[a-zA-Z]:/, '');

        return windowsPathPattern.test(path) && !invalidChars.test(pathWithoutDrive);
    }

    /**
     * Check if a path is valid for Linux
     * @param path Path to validate
     * @returns True if valid Linux path
     */
    static isValidLinuxPath(path: string): boolean {
        if (!path || typeof path !== 'string') {
            return false;
        }

        // Check for null bytes
        if (path.includes('\0')) {
            return false;
        }

        // Linux paths typically start with / or are relative
        // Almost any character is valid except null byte
        return path.length > 0 && !path.includes('\0');
    }
}