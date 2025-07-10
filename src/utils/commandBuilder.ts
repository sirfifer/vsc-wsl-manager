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
        // Validate command arguments
        this.validateWSLCommand(args);
        
        return this.execute(this.WSL_COMMAND, args, options);
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
            
            // Collect stdout
            child.stdout?.on('data', (data) => {
                stdout += data.toString(options.encoding || 'utf8');
            });
            
            // Collect stderr
            child.stderr?.on('data', (data) => {
                stderr += data.toString(options.encoding || 'utf8');
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
                    exitCode: code || 0
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
        
        // Check if the primary command is in the whitelist
        const primaryCommand = args[0];
        if (!this.ALLOWED_WSL_COMMANDS.includes(primaryCommand)) {
            // Check if it's a distribution command (-d)
            if (primaryCommand !== '-d' && primaryCommand !== '--distribution') {
                throw new Error(`Command '${primaryCommand}' is not allowed`);
            }
        }
        
        // Validate all arguments don't contain shell metacharacters
        const dangerousChars = /[;&|`$(){}[\]<>\\n\\r]/;
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
    static buildListCommand(verbose = true): string[] {
        const args = ['--list'];
        if (verbose) {
            args.push('--verbose');
        }
        return args;
    }
    
    /**
     * Build safe command for WSL import operation
     * @param name Distribution name
     * @param installLocation Installation directory
     * @param tarPath TAR file path
     * @returns Command arguments
     */
    static buildImportCommand(name: string, installLocation: string, tarPath: string): string[] {
        return ['--import', name, installLocation, tarPath];
    }
    
    /**
     * Build safe command for WSL export operation
     * @param name Distribution name
     * @param exportPath Export file path
     * @returns Command arguments
     */
    static buildExportCommand(name: string, exportPath: string): string[] {
        return ['--export', name, exportPath];
    }
    
    /**
     * Build safe command for WSL unregister operation
     * @param name Distribution name
     * @returns Command arguments
     */
    static buildUnregisterCommand(name: string): string[] {
        return ['--unregister', name];
    }
    
    /**
     * Build safe command for WSL terminate operation
     * @param name Distribution name
     * @returns Command arguments
     */
    static buildTerminateCommand(name: string): string[] {
        return ['--terminate', name];
    }
    
    /**
     * Build safe command for WSL set default operation
     * @param name Distribution name
     * @returns Command arguments
     */
    static buildSetDefaultCommand(name: string): string[] {
        return ['--set-default', name];
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
}