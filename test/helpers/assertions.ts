/**
 * Real Assertions Helper
 * Validates actual system state without mocks
 *
 * @author Marcus Johnson, QA Manager
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'vitest';

/**
 * Asserts that a WSL distribution exists on the system
 * @param name Distribution name to check
 * @param shouldExist Whether it should exist or not
 */
export async function assertDistributionExists(name: string, shouldExist: boolean = true): Promise<void> {
    const distributions = await getRealDistributions();
    const exists = distributions.some(d => d.includes(name));

    if (shouldExist) {
        expect(exists, `Distribution ${name} should exist`).toBe(true);
    } else {
        expect(exists, `Distribution ${name} should not exist`).toBe(false);
    }
}

/**
 * Asserts that a command executes successfully
 * @param command Command to execute
 * @param args Command arguments
 */
export async function assertCommandSucceeds(
    command: string,
    args: string[] = []
): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, {
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
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });

        process.on('error', (err) => {
            reject(new Error(`Command execution failed: ${err.message}`));
        });
    });
}

/**
 * Asserts that a file was created
 * @param filePath Path to check
 * @param timeout Maximum time to wait for file creation
 */
export async function assertFileCreated(filePath: string, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (fs.existsSync(filePath)) {
            // File exists, check it's accessible
            const stats = fs.statSync(filePath);
            expect(stats.isFile(), `${filePath} should be a file`).toBe(true);
            return;
        }
        await sleep(100);
    }

    throw new Error(`File ${filePath} was not created within ${timeout}ms`);
}

/**
 * Asserts that a directory exists and is accessible
 * @param dirPath Directory path to check
 */
export function assertDirectoryExists(dirPath: string): void {
    expect(fs.existsSync(dirPath), `Directory ${dirPath} should exist`).toBe(true);

    const stats = fs.statSync(dirPath);
    expect(stats.isDirectory(), `${dirPath} should be a directory`).toBe(true);
}

/**
 * Asserts WSL command output matches expected pattern
 * @param output Actual output
 * @param pattern Expected pattern (string or regex)
 */
export function assertWSLOutput(output: string, pattern: string | RegExp): void {
    if (typeof pattern === 'string') {
        expect(output, `Output should contain "${pattern}"`).toContain(pattern);
    } else {
        expect(output, `Output should match pattern ${pattern}`).toMatch(pattern);
    }
}

/**
 * Asserts that a distribution is in a specific state
 * @param name Distribution name
 * @param expectedState Expected state
 */
export async function assertDistributionState(
    name: string,
    expectedState: 'Running' | 'Stopped'
): Promise<void> {
    const state = await getDistributionState(name);
    expect(state, `Distribution ${name} should be ${expectedState}`).toBe(expectedState);
}

/**
 * Asserts that a TAR file is valid
 * @param tarPath Path to TAR file
 */
export function assertValidTarFile(tarPath: string): void {
    expect(fs.existsSync(tarPath), `TAR file ${tarPath} should exist`).toBe(true);

    const stats = fs.statSync(tarPath);
    expect(stats.size, 'TAR file should not be empty').toBeGreaterThan(0);

    // Check TAR magic bytes (simplified check)
    const buffer = Buffer.alloc(512);
    const fd = fs.openSync(tarPath, 'r');
    fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    // TAR files have 'ustar' at offset 257 (for POSIX format)
    // or may be all zeros for end-of-archive
    const magic = buffer.toString('utf8', 257, 262);
    const isValidTar = magic === 'ustar' || buffer.every(b => b === 0);

    expect(isValidTar, 'File should be a valid TAR archive').toBe(true);
}

/**
 * Asserts that a process is running
 * @param processName Process name to check
 */
export async function assertProcessRunning(processName: string): Promise<void> {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'tasklist' : 'ps';
    const args = isWindows ? [] : ['aux'];

    const output = await assertCommandSucceeds(command, args);
    expect(output.toLowerCase()).toContain(processName.toLowerCase());
}

/**
 * Asserts that an error is of a specific type
 * @param error Error to check
 * @param expectedType Expected error type or message pattern
 */
export function assertErrorType(error: any, expectedType: string | RegExp): void {
    if (typeof expectedType === 'string') {
        expect(error.message || error.toString()).toContain(expectedType);
    } else {
        expect(error.message || error.toString()).toMatch(expectedType);
    }
}

/**
 * Asserts that a function throws an error
 * @param fn Function to test
 * @param expectedError Expected error pattern
 */
export async function assertThrowsAsync(
    fn: () => Promise<any>,
    expectedError?: string | RegExp
): Promise<void> {
    let thrown = false;
    let error: any;

    try {
        await fn();
    } catch (e) {
        thrown = true;
        error = e;
    }

    expect(thrown, 'Function should throw an error').toBe(true);

    if (expectedError) {
        assertErrorType(error, expectedError);
    }
}

/**
 * Asserts that a file contains specific content
 * @param filePath File to check
 * @param expectedContent Content to find
 */
export function assertFileContains(filePath: string, expectedContent: string | RegExp): void {
    expect(fs.existsSync(filePath), `File ${filePath} should exist`).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');

    if (typeof expectedContent === 'string') {
        expect(content).toContain(expectedContent);
    } else {
        expect(content).toMatch(expectedContent);
    }
}

/**
 * Asserts that two arrays contain the same elements (order independent)
 * @param actual Actual array
 * @param expected Expected array
 */
export function assertArrayContainsSame<T>(actual: T[], expected: T[]): void {
    expect(actual.length, 'Arrays should have same length').toBe(expected.length);

    for (const item of expected) {
        expect(actual, `Array should contain ${item}`).toContain(item);
    }
}

// Helper functions

/**
 * Gets real WSL distributions from the system
 */
async function getRealDistributions(): Promise<string[]> {
    return new Promise((resolve) => {
        const process = spawn('wsl.exe', ['--list', '--quiet'], {
            timeout: 5000
        });

        let stdout = '';
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.on('close', () => {
            const distros = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            resolve(distros);
        });

        process.on('error', () => resolve([]));
    });
}

/**
 * Gets the state of a specific distribution
 */
async function getDistributionState(name: string): Promise<string | null> {
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
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Performance assertion - ensures operation completes within time limit
 * @param fn Function to test
 * @param maxTime Maximum execution time in milliseconds
 */
export async function assertPerformance(
    fn: () => Promise<any>,
    maxTime: number,
    description: string = 'Operation'
): Promise<any> {
    const startTime = Date.now();
    const result = await fn();
    const elapsed = Date.now() - startTime;

    expect(elapsed, `${description} should complete within ${maxTime}ms`).toBeLessThanOrEqual(maxTime);

    return result;
}