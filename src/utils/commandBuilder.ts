/**
 * CommandBuilder utility for secure command construction
 * Prevents command injection by using spawn instead of exec and properly escaping parameters
 */

import { spawn, SpawnOptions } from 'child_process';

/**
 * Result of command execution
 */
export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    code?: number; // Alias for exitCode for compatibility
}

/**
 * Options for command execution
 */
export interface CommandOptions {
    timeout?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding;
}

/**
 * Secure command builder and executor
 */
export class CommandBuilder {
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private static readonly WSL_COMMAND = 'wsl.exe';
    
    /**
     * Whitelist of allowed WSL commands
     */
    private static readonly ALLOWED_WSL_COMMANDS = [
        '--list',
        '--verbose',
        '--import',
        '--export',
        '--unregister',
        '--terminate',
        '--set-default',
        '--install',
        '-d',
        '--distribution'
    ];
    
    /**
     * Execute a WSL command securely
     * @param args Command arguments (will be validated and escaped)
     * @param options Execution options
     * @returns Command result
     */
    static async executeWSL(args: string[], options: CommandOptions = {}): Promise<CommandResult> {
        // Handle undefined args
        if (!args || args.length === 0) {
            throw new Error('No command arguments provided');
        }

        // Validate command arguments
        this.validateWSLCommand(args);

        return this.execute(this.WSL_COMMAND, args, options);
    }
    
    /**
     * Execute a PowerShell command safely
     * @param command PowerShell command to execute
     * @param options Execution options
     * @returns Command result
     */
    static async executePowerShell(command: string, options: CommandOptions = {}): Promise<CommandResult> {
        // PowerShell commands should be passed as arguments, not as shell commands
        return this.execute('powershell.exe', ['-Command', command], options);
    }

    /**
     * Execute a system command safely (Windows utilities)
     * @param command Command executable name
     * @param args Command arguments
     * @param options Execution options
     * @returns Command result
     */
    static async executeSystem(command: string, args: string[], options: CommandOptions = {}): Promise<CommandResult> {
        // Whitelist of allowed system commands
        const allowedCommands = ['fsutil', 'where', 'which', 'cmd.exe'];

        if (!allowedCommands.includes(command.toLowerCase()) && !command.toLowerCase().endsWith('.exe')) {
            throw new Error(`Command not allowed for security reasons: ${command}`);
        }

        return this.execute(command, args, options);
    }

    /**
     * Execute a command in a specific WSL distribution
     * @param distribution Distribution name
     * @param command Command to execute
     * @param options Execution options
     * @returns Command result
     */
    static async executeInDistribution(
        distribution: string,
        command: string,
        options: CommandOptions = {}
    ): Promise<CommandResult> {
        // Validate distribution name
        if (!distribution || typeof distribution !== 'string') {
            throw new Error('Invalid distribution name');
        }

        // Build safe command arguments
        const args = ['-d', distribution, '--', 'sh', '-c', command];

        return this.execute(this.WSL_COMMAND, args, options);
    }
    
    /**
     * Execute a command securely using spawn
     * @param command Command to execute
     * @param args Command arguments
     * @param options Execution options
     * @returns Command result
     */
    private static async execute(
        command: string,
        args: string[],
        options: CommandOptions = {}
    ): Promise<CommandResult> {
        return new Promise((resolve, reject) => {
            const spawnOptions: SpawnOptions = {
                cwd: options.cwd,
                env: options.env || process.env,
                shell: false, // Never use shell to prevent injection
                windowsHide: true
            };
            
            const child = spawn(command, args, spawnOptions);
            
            let stdout = '';
            let stderr = '';
            let timeout: NodeJS.Timeout | undefined;
            
            // Set up timeout if specified
            if (options.timeout) {
                timeout = setTimeout(() => {
                    child.kill('SIGTERM');
                    reject(new Error(`Command timed out after ${options.timeout}ms`));
                }, options.timeout);
            }
            
            // Collect stdout - WSL.exe outputs UTF-16LE on Windows
            child.stdout?.on('data', (data) => {
                // Check if this looks like UTF-16 (has null bytes between characters)
                const buffer = Buffer.from(data);
                let decoded: string;
                
                if (buffer.includes(0x00) && buffer[1] === 0x00) {
                    // UTF-16LE encoding detected (common for WSL.exe output)
                    decoded = buffer.toString('utf16le');
                } else {
                    decoded = buffer.toString(options.encoding || 'utf8');
                }
                
                stdout += decoded;
            });
            
            // Collect stderr - also handle UTF-16 for WSL.exe
            child.stderr?.on('data', (data) => {
                const buffer = Buffer.from(data);
                let decoded: string;
                
                if (buffer.includes(0x00) && buffer[1] === 0x00) {
                    // UTF-16LE encoding detected
                    decoded = buffer.toString('utf16le');
                } else {
                    decoded = buffer.toString(options.encoding || 'utf8');
                }
                
                stderr += decoded;
            });
            
            // Handle process exit
            child.on('close', (code, signal) => {
                if (timeout) {
                    clearTimeout(timeout);
                }
                
                if (signal) {
                    reject(new Error(`Process terminated by signal: ${signal}`));
                    return;
                }
                
                const result: CommandResult = {
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code || 0,
                    code: code || 0 // Alias for compatibility
                };
                
                if (code !== 0) {
                    const error = new Error(`Command failed with exit code ${code}: ${stderr || stdout}`);
                    (error as any).result = result;
                    reject(error);
                } else {
                    resolve(result);
                }
            });
            
            // Handle process errors
            child.on('error', (error) => {
                if (timeout) {
                    clearTimeout(timeout);
                }
                reject(error);
            });
        });
    }
    
    /**
     * Validate WSL command arguments
     * @param args Command arguments to validate
     */
    private static validateWSLCommand(args: string[]): void {
        if (!args || args.length === 0) {
            throw new Error('No command arguments provided');
        }

        // Skip validation if it's the wsl.exe command itself
        const primaryCommand = args[0];
        if (primaryCommand === 'wsl.exe' || primaryCommand === 'wsl') {
            return; // Allow wsl.exe itself
        }

        // Check if the primary command is in the whitelist
        if (!this.ALLOWED_WSL_COMMANDS.includes(primaryCommand)) {
            // Check if it's a distribution command (-d)
            if (primaryCommand !== '-d' && primaryCommand !== '--distribution') {
                throw new Error(`Command '${primaryCommand}' is not allowed`);
            }
        }
        
        // Validate all arguments don't contain shell metacharacters
        const dangerousChars = /[;&|`$(){}\[\]<>\n\r]/;
        for (const arg of args) {
            if (dangerousChars.test(arg)) {
                throw new Error('Command arguments contain potentially dangerous characters');
            }
        }
    }
    
    /**
     * Build safe command for WSL list operation
     * @param verbose Include verbose output
     * @returns Command arguments
     */
    static buildListCommand(verbose = true): { command: string; args: string[] } {
        const args = ['--list'];
        if (verbose) {
            args.push('--verbose');
        }
        return { command: 'wsl.exe', args };
    }
    
    /**
     * Build safe command for WSL import operation
     * @param name Distribution name
     * @param installLocation Installation directory
     * @param tarPath TAR file path
     * @returns Command arguments
     */
    static buildCreateCommand(name: string, baseDistro: string): { command: string; args: string[] } {
        if (!name || !baseDistro) {
            throw new Error('Distribution name and base distro are required');
        }
        const cleanName = name.trim().replace(/[\r\n]+/g, '');
        const cleanBase = baseDistro.trim().replace(/[\r\n]+/g, '');
        this.validateDistributionName(cleanName);
        this.validateDistributionName(cleanBase);
        return { command: 'wsl.exe', args: ['--clone', cleanBase, cleanName] };
    }

    static buildImportCommand(name: string, installLocation: string, tarPath: string): { command: string; args: string[] } {
        const cleanName = name.trim().replace(/[\r\n]+/g, '');
        this.validateDistributionName(cleanName);
        this.validatePath(installLocation);
        this.validatePath(tarPath);
        return { command: 'wsl.exe', args: ['--import', cleanName, installLocation, tarPath] };
    }
    
    /**
     * Build safe command for WSL export operation
     * @param name Distribution name
     * @param exportPath Export file path
     * @returns Command arguments
     */
    static buildExportCommand(name: string, exportPath: string): { command: string; args: string[] } {
        // Clean the name before validation and use
        const cleanName = name.trim().replace(/[\r\n]+/g, '');
        this.validateDistributionName(cleanName);
        this.validatePath(exportPath);
        return { command: 'wsl.exe', args: ['--export', cleanName, exportPath] };
    }

    static buildUnregisterCommand(name: string): { command: string; args: string[] } {
        const cleanName = name.trim().replace(/[\r\n]+/g, '');
        this.validateDistributionName(cleanName);
        return { command: 'wsl.exe', args: ['--unregister', cleanName] };
    }

    static buildTerminateCommand(name: string): { command: string; args: string[] } {
        const cleanName = name.trim().replace(/[\r\n]+/g, '');
        this.validateDistributionName(cleanName);
        return { command: 'wsl.exe', args: ['--terminate', cleanName] };
    }

    static buildSetDefaultCommand(name: string): { command: string; args: string[] } {
        const cleanName = name.trim().replace(/[\r\n]+/g, '');
        this.validateDistributionName(cleanName);
        return { command: 'wsl.exe', args: ['--set-default', cleanName] };
    }

    static buildRunCommand(distro: string, command: string): { command: string; args: string[] } {
        // Clean and validate distribution name
        const cleanDistro = distro.trim().replace(/[\r\n]+/g, '');
        this.validateDistributionName(cleanDistro);

        const dangerous = /[;&|`$<>(){}[\]\n\r\0]/;
        if (dangerous.test(command) || command.includes('..')) {
            throw new Error('Command contains dangerous characters');
        }

        // Parse the command into arguments
        const commandArgs = command.split(' ').map(arg => {
            // Remove quotes if present
            if ((arg.startsWith('"') && arg.endsWith('"')) ||
                (arg.startsWith("'") && arg.endsWith("'"))) {
                return arg.slice(1, -1);
            }
            return arg;
        });

        const args = ['wsl.exe', '-d', cleanDistro, '--', ...commandArgs];
        return { command: args[0], args };
    }
    
    /**
     * Parse command output safely
     * @param output Raw command output
     * @returns Parsed lines
     */
    static parseOutput(output: string): string[] {
        if (!output) {
            return [];
        }

        // Split by newlines and filter empty lines
        return output
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    /**
     * Validate distribution name
     * @param name Distribution name
     * @throws Error if name is invalid
     */
    private static validateDistributionName(name: string): void {
        // Clean the name first (remove any line endings or extra whitespace)
        const cleanName = name.trim().replace(/[\r\n]+/g, '');

        if (!cleanName || cleanName.length === 0) {
            throw new Error('Distribution name cannot be empty');
        }

        // Check length limits
        if (cleanName.length > 255) {
            throw new Error('Distribution name too long');
        }

        // Check for dangerous characters (but not newlines since we cleaned them)
        // Also don't check for backslash as it's not dangerous in distribution names
        const dangerous = /[;&|`$<>(){}\[\]]/;
        if (dangerous.test(cleanName)) {
            throw new Error('Distribution name contains dangerous characters');
        }

        // Check for path traversal
        if (cleanName.includes('..')) {
            throw new Error('Distribution name contains path traversal');
        }
    }

    /**
     * Validate file path
     * @param path File path
     * @throws Error if path is invalid
     */
    private static validatePath(path: string): void {
        if (!path || path.length === 0) {
            throw new Error('Path cannot be empty');
        }

        // Check for dangerous shell characters (but allow Windows backslashes and spaces)
        const dangerous = /[;&|`$(){}\[\]\n\r<>]/;
        if (dangerous.test(path)) {
            throw new Error('Path contains dangerous characters');
        }

        // Check for path traversal - both Unix and Windows style
        if (path.includes('..')) {
            throw new Error('Path traversal detected');
        }
    }

    /**
     * Escape argument for shell
     * @param arg Argument to escape
     * @returns Escaped argument
     */
    static escapeArgument(arg: string): string {
        // Check for dangerous characters
        if (arg.includes('\0')) {
            throw new Error('Null bytes not allowed');
        }
        if (arg.includes('\n') || arg.includes('\r')) {
            throw new Error('Newlines not allowed');
        }

        // For Windows, wrap in quotes ONLY if contains spaces or special chars
        // Don't quote simple strings
        if (arg.includes(' ') || /[&|<>^();]/.test(arg)) {
            return `"${arg.replace(/"/g, '""')}"`;
        }
        return arg;
    }

}