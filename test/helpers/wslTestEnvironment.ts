/**
 * WSL Test Environment Helper
 * Provides real WSL operations for test isolation
 * NO MOCKS - All operations use actual WSL commands
 *
 * @author Marcus Johnson, QA Manager
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface TestDistribution {
    name: string;
    created: Date;
    basedOn?: string;
}

/**
 * Manages real WSL test distributions for isolated testing
 * All operations execute actual WSL commands
 */
export class WSLTestEnvironment {
    private readonly testDistributions: Map<string, TestDistribution> = new Map();
    private readonly testPrefix = 'wsl-test-';
    private readonly testTarPath = path.join(__dirname, '../fixtures/distributions');

    constructor() {
        // Ensure test fixture directory exists
        if (!fs.existsSync(this.testTarPath)) {
            fs.mkdirSync(this.testTarPath, { recursive: true });
        }
    }

    /**
     * Creates a real test distribution using WSL
     * @param name Test distribution name (will be prefixed)
     * @param baseDistro Optional base distribution to clone
     * @returns Promise resolving when distribution is created
     */
    async createTestDistribution(name: string, baseDistro?: string): Promise<void> {
        const fullName = `${this.testPrefix}${name}-${crypto.randomBytes(4).toString('hex')}`;

        return new Promise((resolve, reject) => {
            const args = baseDistro
                ? ['--clone', baseDistro, fullName]
                : ['--import', fullName, this.getTestTarPath(), this.getMinimalTar()];

            const process = spawn('wsl.exe', args, {
                timeout: 30000
            });

            let stderr = '';
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    this.testDistributions.set(fullName, {
                        name: fullName,
                        created: new Date(),
                        basedOn: baseDistro
                    });
                    resolve();
                } else {
                    reject(new Error(`Failed to create test distribution: ${stderr}`));
                }
            });

            process.on('error', reject);
        });
    }

    /**
     * Removes a test distribution from WSL
     * @param name Full distribution name or test name
     */
    async cleanupTestDistribution(name: string): Promise<void> {
        const fullName = name.startsWith(this.testPrefix) ? name : `${this.testPrefix}${name}`;

        return new Promise((resolve, reject) => {
            const process = spawn('wsl.exe', ['--unregister', fullName], {
                timeout: 30000
            });

            process.on('close', (code) => {
                if (code === 0 || code === 1) { // 1 = not found, which is ok
                    this.testDistributions.delete(fullName);
                    resolve();
                } else {
                    reject(new Error(`Failed to cleanup distribution ${fullName}`));
                }
            });

            process.on('error', reject);
        });
    }

    /**
     * Waits for a distribution to reach a specific state
     * @param name Distribution name
     * @param state Target state ('Running' or 'Stopped')
     * @param timeout Maximum wait time in milliseconds
     */
    async waitForDistributionState(
        name: string,
        state: 'Running' | 'Stopped',
        timeout: number = 10000
    ): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const currentState = await this.getDistributionState(name);
            if (currentState === state) {
                return;
            }
            await this.sleep(500);
        }

        throw new Error(`Timeout waiting for distribution ${name} to reach state ${state}`);
    }

    /**
     * Gets the current state of a distribution
     * @param name Distribution name
     * @returns Current state or null if not found
     */
    private async getDistributionState(name: string): Promise<string | null> {
        return new Promise((resolve) => {
            const process = spawn('wsl.exe', ['--list', '--verbose'], {
                timeout: 5000
            });

            let stdout = '';
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.on('close', () => {
                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (line.includes(name)) {
                        // Parse state from WSL output
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 3) {
                            resolve(parts[2]); // State is typically third column
                        }
                    }
                }
                resolve(null);
            });

            process.on('error', () => resolve(null));
        });
    }

    /**
     * Cleanup all test distributions created during testing
     */
    async cleanupAll(): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const [name] of this.testDistributions) {
            promises.push(this.cleanupTestDistribution(name));
        }

        await Promise.allSettled(promises);
        this.testDistributions.clear();
    }

    /**
     * Execute a command in a test distribution
     * @param distroName Distribution name
     * @param command Command to execute
     * @returns Command output
     */
    async executeInDistribution(distroName: string, command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const process = spawn('wsl.exe', ['-d', distroName, '--', command], {
                timeout: 10000
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Command failed: ${stderr}`));
                }
            });

            process.on('error', reject);
        });
    }

    /**
     * List all real WSL distributions on the system
     * @returns Array of distribution names
     */
    async listRealDistributions(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const process = spawn('wsl.exe', ['--list', '--quiet'], {
                timeout: 5000
            });

            let stdout = '';
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    const distros = stdout
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                    resolve(distros);
                } else {
                    reject(new Error('Failed to list distributions'));
                }
            });

            process.on('error', reject);
        });
    }

    /**
     * Gets path to test TAR files
     */
    private getTestTarPath(): string {
        // Create temp directory for test imports
        const tempDir = path.join(process.env.TEMP || '/tmp', 'wsl-test-imports');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        return tempDir;
    }

    /**
     * Gets path to minimal TAR file for testing
     * Creates one if it doesn't exist
     */
    private getMinimalTar(): string {
        const tarPath = path.join(this.testTarPath, 'minimal-alpine.tar');

        // Check if we have a test TAR file
        if (!fs.existsSync(tarPath)) {
            // In a real scenario, we'd download or create a minimal Alpine TAR
            // For testing, we'll throw an error indicating setup is needed
            throw new Error(
                'Test TAR file not found. Please place a minimal Alpine TAR at: ' + tarPath
            );
        }

        return tarPath;
    }

    /**
     * Helper to sleep for a specified duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Global test environment instance
 */
export const testEnv = new WSLTestEnvironment();

/**
 * Test cleanup helper for use in afterEach hooks
 */
export async function cleanupTestDistributions(): Promise<void> {
    await testEnv.cleanupAll();
}