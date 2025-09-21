/**
 * Cross-Platform Command Executor
 * Based on cross-platform-dev-guide.md
 *
 * Provides platform-aware command execution with proper executable resolution
 */

import { spawn, SpawnOptions } from 'child_process';
import { PLATFORM } from './platform';
import { Logger } from './logger';

const logger = Logger.getInstance();

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export class CrossPlatformCommandExecutor {
    /**
     * Execute command with platform-aware executable resolution
     */
    async executeCommand(
        command: string,
        args: string[] = [],
        options: SpawnOptions = {}
    ): Promise<CommandResult> {
        const executable = this.resolveExecutable(command);

        logger.debug(`Executing command: ${executable} ${args.join(' ')}`);

        return new Promise((resolve, reject) => {
            const process = spawn(executable, args, {
                ...options,
                shell: PLATFORM.isWindows // Use shell on Windows for .cmd/.bat files
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (exitCode) => {
                resolve({
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: exitCode || 0
                });
            });

            process.on('error', (error) => {
                logger.error(`Command execution failed: ${error.message}`);
                reject(new Error(`Command execution failed: ${error.message}`));
            });
        });
    }

    /**
     * Resolve executable name for current platform
     */
    private resolveExecutable(command: string): string {
        if (PLATFORM.isWindows) {
            // Add .exe if not present and command doesn't have extension
            if (!command.includes('.') && !command.endsWith('.exe')) {
                // Special case for built-in Windows commands
                if (command === 'tar') {
                    return 'tar.exe';
                }
                return `${command}.exe`;
            }
        }
        return command;
    }

    /**
     * Check if command is available on the system
     */
    async isCommandAvailable(command: string): Promise<boolean> {
        try {
            const executable = this.resolveExecutable(command);
            const testCommand = PLATFORM.isWindows ? 'where' : 'which';
            const result = await this.executeCommand(testCommand, [executable]);
            return result.exitCode === 0;
        } catch {
            return false;
        }
    }

    /**
     * Execute command with timeout
     */
    async executeWithTimeout(
        command: string,
        args: string[] = [],
        timeoutMs: number = 30000,
        options: SpawnOptions = {}
    ): Promise<CommandResult> {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Command timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            try {
                const result = await this.executeCommand(command, args, options);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
}