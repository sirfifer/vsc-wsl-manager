import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { CommandBuilder } from './utils/commandBuilder';
import { InputValidator } from './utils/inputValidator';
import { SecurityValidator } from './security/securityValidator';
import { ErrorHandler, WSLError, ErrorType } from './errors/errorHandler';
import { logger } from './utils/logger';

/**
 * Represents a WSL distribution with its current state and metadata
 */
export interface WSLDistribution {
    /** The name of the WSL distribution */
    name: string;
    /** Current state of the distribution */
    state: 'Running' | 'Stopped';
    /** WSL version (1 or 2) */
    version: string;
    /** Whether this is the default distribution */
    default: boolean;
}

/**
 * Manages WSL distributions and operations
 * 
 * @example
 * ```typescript
 * const manager = new WSLManager();
 * const distributions = await manager.listDistributions();
 * ```
 */
export class WSLManager {
    private readonly securityValidator = SecurityValidator.getInstance();
    private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private readonly LONG_OPERATION_TIMEOUT = 300000; // 5 minutes for import/export
    
    /**
     * Lists all WSL distributions on the system
     * 
     * @returns Promise resolving to array of WSL distributions
     * @throws {WSLError} When WSL is not installed
     * 
     * @example
     * ```typescript
     * const distributions = await wslManager.listDistributions();
     * console.log(`Found ${distributions.length} distributions`);
     * ```
     */
    async listDistributions(): Promise<WSLDistribution[]> {
        const startTime = Date.now();
        logger.debug('Listing WSL distributions');
        
        try {
            // Security check
            const securityResult = await this.securityValidator.validateCommand({
                command: 'list',
                args: ['--list', '--verbose'],
                timestamp: Date.now()
            });
            
            if (!securityResult.allowed) {
                logger.security('List command blocked', { reason: securityResult.reason });
                return [];
            }
            
            // Execute command securely with timeout
            const result = await ErrorHandler.withTimeout(
                CommandBuilder.executeWSL(CommandBuilder.buildListCommand()),
                this.DEFAULT_TIMEOUT,
                'list distributions'
            );
            
            const distributions = this.parseDistributions(result.stdout);
            logger.performance('Listed distributions', Date.now() - startTime, { count: distributions.length });
            return distributions;
        } catch (error) {
            logger.error('Failed to list WSL distributions', error);
            
            // Check if WSL is installed
            if (ErrorHandler.determineErrorType(error) === ErrorType.WSL_NOT_INSTALLED) {
                throw new WSLError(
                    ErrorType.WSL_NOT_INSTALLED,
                    'WSL is not installed on this system',
                    'Please install WSL to use this extension',
                    ['Install WSL from the Microsoft Store', 'Run "wsl --install" in an elevated PowerShell']
                );
            }
            return [];
        }
    }

    /**
     * Parses WSL command output into distribution objects
     * @private
     * @param output - Raw output from wsl --list --verbose
     * @returns Array of parsed distributions
     */
    private parseDistributions(output: string): WSLDistribution[] {
        const lines = CommandBuilder.parseOutput(output);
        const distributions: WSLDistribution[] = [];

        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            // Parse WSL output format
            const isDefault = line.startsWith('*');
            const cleanLine = line.replace('*', '').trim();
            
            // Split by multiple spaces (WSL uses spacing for columns)
            const parts = cleanLine.split(/\s{2,}/);
            
            if (parts.length >= 3) {
                distributions.push({
                    name: parts[0].trim(),
                    state: parts[1].trim() as 'Running' | 'Stopped',
                    version: parts[2].trim(),
                    default: isDefault
                });
            }
        }

        return distributions;
    }

    /**
     * Creates a new WSL distribution by cloning an existing one
     * 
     * @param name - Name for the new distribution
     * @param baseDistro - Name of the existing distribution to clone
     * @throws {Error} When distribution name is invalid or base distribution doesn't exist
     * @throws {WSLError} For security violations or operation failures
     * 
     * @example
     * ```typescript
     * await wslManager.createDistribution('my-dev-env', 'Ubuntu');
     * ```
     */
    async createDistribution(name: string, baseDistro: string): Promise<void> {
        const startTime = Date.now();
        logger.info('Creating distribution', { name, baseDistro });
        
        // Validate inputs
        const nameValidation = InputValidator.validateDistributionName(name);
        if (!nameValidation.isValid) {
            logger.warn('Invalid distribution name', { name, error: nameValidation.error });
            throw new Error(`Invalid distribution name: ${nameValidation.error}`);
        }
        
        const baseValidation = InputValidator.validateDistributionName(baseDistro);
        if (!baseValidation.isValid) {
            logger.warn('Invalid base distribution name', { baseDistro, error: baseValidation.error });
            throw new Error(`Invalid base distribution name: ${baseValidation.error}`);
        }

        // Security check
        const securityResult = await this.securityValidator.validateCommand({
            command: 'create',
            args: ['create', nameValidation.sanitizedValue!, baseValidation.sanitizedValue!],
            timestamp: Date.now()
        });
        
        if (!securityResult.allowed) {
            throw new Error(`Security validation failed: ${securityResult.reason}`);
        }

        // First, ensure the base distribution is installed
        await this.ensureBaseDistribution(baseValidation.sanitizedValue!);

        // Create secure temporary file
        const tempDir = process.env.TEMP || '/tmp';
        const randomSuffix = crypto.randomBytes(8).toString('hex');
        const tempPath = path.join(tempDir, `wsl-export-${randomSuffix}.tar`);

        try {
            // Export the base distribution
            await this.exportDistribution(baseValidation.sanitizedValue!, tempPath);

            // Import as new distribution
            const installPath = this.getDefaultInstallPath(nameValidation.sanitizedValue!);
            await this.importDistribution(nameValidation.sanitizedValue!, tempPath, installPath);
            
            logger.performance('Created distribution', Date.now() - startTime, { name: nameValidation.sanitizedValue });
        } finally {
            // Clean up temp file
            try {
                await fs.promises.unlink(tempPath);
                logger.debug('Cleaned up temporary file', { path: tempPath });
            } catch (error) {
                logger.error('Failed to clean up temp file', error, { path: tempPath });
            }
        }
    }

    /**
     * Imports a TAR file as a new WSL distribution
     * 
     * @param name - Name for the imported distribution
     * @param tarPath - Path to the TAR file to import
     * @param installLocation - Optional custom installation directory
     * @throws {Error} When inputs are invalid or file doesn't exist
     * @throws {WSLError} When distribution already exists or import fails
     * 
     * @example
     * ```typescript
     * await wslManager.importDistribution('imported-ubuntu', '/path/to/ubuntu.tar');
     * ```
     */
    async importDistribution(name: string, tarPath: string, installLocation?: string): Promise<void> {
        // Validate inputs
        const nameValidation = InputValidator.validateDistributionName(name);
        if (!nameValidation.isValid) {
            throw new Error(`Invalid distribution name: ${nameValidation.error}`);
        }
        
        const pathValidation = InputValidator.validateFilePath(tarPath, {
            mustExist: true,
            allowedExtensions: ['.tar']
        });
        if (!pathValidation.isValid) {
            throw new Error(`Invalid TAR file path: ${pathValidation.error}`);
        }
        
        const location = installLocation || this.getDefaultInstallPath(nameValidation.sanitizedValue!);
        const dirValidation = InputValidator.validateDirectoryPath(location, {
            createIfNotExists: true
        });
        if (!dirValidation.isValid) {
            throw new Error(`Invalid installation location: ${dirValidation.error}`);
        }

        // Security check
        const securityResult = await this.securityValidator.validateCommand({
            command: 'import',
            args: ['--import', nameValidation.sanitizedValue!, dirValidation.sanitizedValue!, pathValidation.sanitizedValue!],
            timestamp: Date.now()
        });
        
        if (!securityResult.allowed) {
            throw new Error(`Security validation failed: ${securityResult.reason}`);
        }

        // Ensure the directory exists
        await fs.promises.mkdir(dirValidation.sanitizedValue!, { recursive: true });

        // Execute import command securely with extended timeout
        try {
            await ErrorHandler.withTimeout(
                CommandBuilder.executeWSL(
                    CommandBuilder.buildImportCommand(
                        nameValidation.sanitizedValue!,
                        dirValidation.sanitizedValue!,
                        pathValidation.sanitizedValue!
                    )
                ),
                this.LONG_OPERATION_TIMEOUT,
                'import distribution'
            );
        } catch (error) {
            // Check for specific import errors
            if (ErrorHandler.determineErrorType(error) === ErrorType.DISTRIBUTION_ALREADY_EXISTS) {
                throw new WSLError(
                    ErrorType.DISTRIBUTION_ALREADY_EXISTS,
                    `Distribution '${nameValidation.sanitizedValue}' already exists`,
                    'A distribution with this name is already registered',
                    ['Choose a different name', 'Unregister the existing distribution first']
                );
            }
            throw error;
        }
    }

    /**
     * Exports a WSL distribution to a TAR file
     * 
     * @param name - Name of the distribution to export
     * @param exportPath - Path where the TAR file will be saved
     * @throws {Error} When inputs are invalid
     * @throws {WSLError} When distribution doesn't exist or export fails
     * 
     * @example
     * ```typescript
     * await wslManager.exportDistribution('Ubuntu', '/backups/ubuntu-backup.tar');
     * ```
     */
    async exportDistribution(name: string, exportPath: string): Promise<void> {
        // Validate inputs
        const nameValidation = InputValidator.validateDistributionName(name);
        if (!nameValidation.isValid) {
            throw new Error(`Invalid distribution name: ${nameValidation.error}`);
        }
        
        const pathValidation = InputValidator.validateFilePath(exportPath, {
            allowedExtensions: ['.tar']
        });
        if (!pathValidation.isValid) {
            throw new Error(`Invalid export path: ${pathValidation.error}`);
        }

        // Security check
        const securityResult = await this.securityValidator.validateCommand({
            command: 'export',
            args: ['--export', nameValidation.sanitizedValue!, pathValidation.sanitizedValue!],
            timestamp: Date.now()
        });
        
        if (!securityResult.allowed) {
            throw new Error(`Security validation failed: ${securityResult.reason}`);
        }

        // Execute export command securely with extended timeout
        try {
            await ErrorHandler.withTimeout(
                CommandBuilder.executeWSL(
                    CommandBuilder.buildExportCommand(
                        nameValidation.sanitizedValue!,
                        pathValidation.sanitizedValue!
                    )
                ),
                this.LONG_OPERATION_TIMEOUT,
                'export distribution'
            );
        } catch (error) {
            // Check for specific export errors
            if (ErrorHandler.determineErrorType(error) === ErrorType.DISTRIBUTION_NOT_FOUND) {
                throw new WSLError(
                    ErrorType.DISTRIBUTION_NOT_FOUND,
                    `Distribution '${nameValidation.sanitizedValue}' not found`,
                    'The specified distribution does not exist',
                    ['Check distribution name spelling', 'Run "wsl --list" to see available distributions']
                );
            }
            throw error;
        }
    }

    /**
     * Unregisters (deletes) a WSL distribution
     * 
     * @param name - Name of the distribution to delete
     * @throws {Error} When distribution name is invalid or operation is cancelled
     * @throws {WSLError} For security violations or operation failures
     * 
     * @remarks
     * This operation is destructive and requires user confirmation
     * 
     * @example
     * ```typescript
     * await wslManager.unregisterDistribution('old-distro');
     * ```
     */
    async unregisterDistribution(name: string): Promise<void> {
        // Validate input
        const validation = InputValidator.validateDistributionName(name);
        if (!validation.isValid) {
            throw new Error(`Invalid distribution name: ${validation.error}`);
        }

        // Security check with permission prompt
        const hasPermission = await this.securityValidator.checkPermission('delete');
        if (!hasPermission) {
            throw new Error('Operation cancelled by user');
        }

        const securityResult = await this.securityValidator.validateCommand({
            command: 'delete',
            args: ['--unregister', validation.sanitizedValue!],
            timestamp: Date.now()
        });
        
        if (!securityResult.allowed) {
            throw new Error(`Security validation failed: ${securityResult.reason}`);
        }

        // Execute unregister command securely
        await CommandBuilder.executeWSL(
            CommandBuilder.buildUnregisterCommand(validation.sanitizedValue!)
        );
    }

    /**
     * Terminates a running WSL distribution
     * 
     * @param name - Name of the distribution to terminate
     * @throws {Error} When distribution name is invalid
     * @throws {WSLError} For security violations or operation failures
     * 
     * @example
     * ```typescript
     * await wslManager.terminateDistribution('Ubuntu');
     * ```
     */
    async terminateDistribution(name: string): Promise<void> {
        // Validate input
        const validation = InputValidator.validateDistributionName(name);
        if (!validation.isValid) {
            throw new Error(`Invalid distribution name: ${validation.error}`);
        }

        // Security check
        const securityResult = await this.securityValidator.validateCommand({
            command: 'terminate',
            args: ['--terminate', validation.sanitizedValue!],
            timestamp: Date.now()
        });
        
        if (!securityResult.allowed) {
            throw new Error(`Security validation failed: ${securityResult.reason}`);
        }

        // Execute terminate command securely
        await CommandBuilder.executeWSL(
            CommandBuilder.buildTerminateCommand(validation.sanitizedValue!)
        );
    }

    /**
     * Sets a distribution as the default WSL distribution
     * 
     * @param name - Name of the distribution to set as default
     * @throws {Error} When distribution name is invalid
     * @throws {WSLError} For security violations or operation failures
     * 
     * @example
     * ```typescript
     * await wslManager.setDefaultDistribution('Ubuntu-20.04');
     * ```
     */
    async setDefaultDistribution(name: string): Promise<void> {
        // Validate input
        const validation = InputValidator.validateDistributionName(name);
        if (!validation.isValid) {
            throw new Error(`Invalid distribution name: ${validation.error}`);
        }

        // Security check
        const securityResult = await this.securityValidator.validateCommand({
            command: 'set-default',
            args: ['--set-default', validation.sanitizedValue!],
            timestamp: Date.now()
        });
        
        if (!securityResult.allowed) {
            throw new Error(`Security validation failed: ${securityResult.reason}`);
        }

        // Execute set-default command securely
        await CommandBuilder.executeWSL(
            CommandBuilder.buildSetDefaultCommand(validation.sanitizedValue!)
        );
    }

    private async ensureBaseDistribution(distroName: string): Promise<void> {
        const distributions = await this.listDistributions();
        const exists = distributions.some(d => d.name.toLowerCase() === distroName.toLowerCase());

        if (!exists) {
            throw new Error(`Base distribution '${distroName}' is not installed. Please install it from the Microsoft Store first.`);
        }
    }

    private getDefaultInstallPath(name: string): string {
        // Validate name before using it in path
        const validation = InputValidator.validateDistributionName(name);
        if (!validation.isValid) {
            throw new Error(`Invalid distribution name for path: ${validation.error}`);
        }

        const config = vscode.workspace.getConfiguration('wsl-manager');
        const defaultPath = config.get<string>('defaultDistributionPath');
        
        if (defaultPath) {
            // Validate configured path
            const pathValidation = InputValidator.validateDirectoryPath(defaultPath);
            if (pathValidation.isValid) {
                return path.join(pathValidation.sanitizedValue!, validation.sanitizedValue!);
            }
        }

        // Default to user's home directory
        const homeDir = process.env.USERPROFILE || process.env.HOME || '';
        return path.join(homeDir, 'WSL', 'Distributions', validation.sanitizedValue!);
    }

    /**
     * Runs a command inside a WSL distribution
     * 
     * @param distribution - Name of the distribution to run the command in
     * @param command - Command to execute
     * @returns Command output (stdout)
     * @throws {Error} When distribution name is invalid
     * @throws {WSLError} For security violations or command failures
     * 
     * @example
     * ```typescript
     * const kernelVersion = await wslManager.runCommand('Ubuntu', 'uname -r');
     * ```
     */
    async runCommand(distribution: string, command: string): Promise<string> {
        // Validate distribution name
        const validation = InputValidator.validateDistributionName(distribution);
        if (!validation.isValid) {
            throw new Error(`Invalid distribution name: ${validation.error}`);
        }

        // Security check
        const securityResult = await this.securityValidator.validateCommand({
            command: 'command',
            args: ['-d', validation.sanitizedValue!, command],
            timestamp: Date.now()
        });
        
        if (!securityResult.allowed) {
            throw new Error(`Security validation failed: ${securityResult.reason}`);
        }

        // Execute command in distribution securely
        const result = await CommandBuilder.executeInDistribution(
            validation.sanitizedValue!,
            command
        );
        
        return result.stdout;
    }

    /**
     * Gets detailed information about a WSL distribution
     * 
     * @param name - Name of the distribution
     * @returns Object containing distribution information (kernel, OS, memory)
     * @throws {Error} When distribution name is invalid
     * 
     * @example
     * ```typescript
     * const info = await wslManager.getDistributionInfo('Ubuntu');
     * console.log(`Kernel: ${info.kernel}, OS: ${info.os}`);
     * ```
     */
    async getDistributionInfo(name: string): Promise<any> {
        try {
            // Validate distribution name
            const validation = InputValidator.validateDistributionName(name);
            if (!validation.isValid) {
                throw new Error(`Invalid distribution name: ${validation.error}`);
            }

            const info: any = { name: validation.sanitizedValue };

            // Get kernel version
            info.kernel = await this.runCommand(validation.sanitizedValue!, 'uname -r');
            
            // Get OS info
            try {
                info.os = await this.runCommand(
                    validation.sanitizedValue!,
                    'cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \\"'
                );
            } catch {
                info.os = 'Unknown';
            }

            // Get memory info
            try {
                const memInfo = await this.runCommand(
                    validation.sanitizedValue!,
                    'free -h | grep Mem | awk \'{print $2}\''
                );
                info.totalMemory = memInfo.trim();
            } catch {
                info.totalMemory = 'Unknown';
            }

            return info;
        } catch (error: any) {
            console.error(`Failed to get info for distribution ${name}:`, error);
            return { name, error: InputValidator.sanitizeForDisplay(error.message) };
        }
    }
}