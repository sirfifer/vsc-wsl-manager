/**
 * REAL Integration Tests for Distribution Download
 * These tests actually download distributions and verify functionality
 * NO MOCKS, NO STUBS - Real testing with actual data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DistroManager } from '../../src/distros/DistroManager';
import { DistroDownloader } from '../../src/distros/DistroDownloader';
import { CommandBuilder } from '../../src/utils/commandBuilder';

// Only run these tests when explicitly requested
const RUN_REAL_TESTS = process.env.REAL_TESTS === 'true' || process.env.TEST_DOWNLOAD === 'true';
const describeReal = RUN_REAL_TESTS ? describe : describe.skip;

describe('Real Download Integration Tests', () => {
    let tempDir: string;
    let distroManager: DistroManager;
    let downloader: DistroDownloader;
    let downloadedDistros: string[] = [];

    beforeAll(() => {
        // Create temp directory for test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-real-test-'));
        console.log(`Test directory: ${tempDir}`);

        // Initialize managers with test directory
        distroManager = new DistroManager(tempDir);
        downloader = new DistroDownloader(distroManager);
    });

    afterAll(async () => {
        // Clean up downloaded distributions from WSL
        for (const distroName of downloadedDistros) {
            try {
                await CommandBuilder.executeWSL(['--unregister', distroName], { timeout: 10000 });
                console.log(`Cleaned up WSL distribution: ${distroName}`);
            } catch (error) {
                console.warn(`Failed to clean up ${distroName}:`, error);
            }
        }

        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
            console.log(`Cleaned up temp directory: ${tempDir}`);
        }
    });

    describe('Distro Manager Real Tests', () => {
        test('should list real distributions from catalog', async () => {
            const distros = await distroManager.listDistros();

            // Should have default distributions
            expect(distros.length).toBeGreaterThan(0);

            // Check for expected distros
            const distroNames = distros.map(d => d.name);
            expect(distroNames).toContain('ubuntu-24.04');
            expect(distroNames).toContain('alpine-3.19');

            // Each distro should have required fields
            for (const distro of distros) {
                expect(distro.name).toBeDefined();
                expect(distro.displayName).toBeDefined();
                expect(distro.sourceUrl).toBeDefined();
                expect(distro.architecture).toBeDefined();
            }

            console.log(`Found ${distros.length} distributions in catalog`);
        });
    });

    describeReal('Alpine Download Test (Small - ~50MB)', () => {
        const ALPINE_NAME = 'alpine-3.19';
        const DOWNLOAD_TIMEOUT = 120000; // 2 minutes

        test('should download Alpine Linux successfully', async () => {
            jest.setTimeout(DOWNLOAD_TIMEOUT);

            // Track download progress
            const progressUpdates: number[] = [];
            let lastProgress = 0;

            await downloader.downloadDistro(ALPINE_NAME, {
                onProgress: (progress) => {
                    const percent = progress.percent || 0;
                    progressUpdates.push(percent);

                    // Log every 10%
                    if (percent - lastProgress >= 10) {
                        console.log(`Download progress: ${percent.toFixed(0)}% (${formatBytes(progress.downloaded)}/${formatBytes(progress.total)})`);
                        lastProgress = percent;
                    }
                }
            });

            // Verify download completed
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1]).toBeGreaterThanOrEqual(95); // Allow for rounding

            // Verify file exists
            const distroPath = distroManager.getDistroPath(ALPINE_NAME);
            expect(fs.existsSync(distroPath)).toBe(true);

            // Verify file size (Alpine is typically 50-100MB)
            const stats = fs.statSync(distroPath);
            expect(stats.size).toBeGreaterThan(40 * 1024 * 1024); // At least 40MB
            expect(stats.size).toBeLessThan(150 * 1024 * 1024); // Less than 150MB

            console.log(`Downloaded Alpine: ${formatBytes(stats.size)}`);
        });

        test('should verify downloaded Alpine integrity', async () => {
            const isValid = await distroManager.verifyDistro(ALPINE_NAME);

            // If SHA256 is available, it should validate
            const distro = await distroManager.getDistro(ALPINE_NAME);
            if (distro?.sha256) {
                expect(isValid).toBe(true);
            }
        });

        test('should import Alpine into WSL', async () => {
            jest.setTimeout(60000);

            const distroPath = distroManager.getDistroPath(ALPINE_NAME);
            const instanceName = `test-alpine-${Date.now()}`;
            const installPath = path.join(tempDir, 'instances', instanceName);

            // Create install directory
            fs.mkdirSync(installPath, { recursive: true });

            // Import to WSL
            console.log(`Importing ${instanceName} to WSL...`);
            const result = await CommandBuilder.executeWSL([
                '--import',
                instanceName,
                installPath,
                distroPath,
                '--version', '2'
            ], { timeout: 60000 });

            expect(result.exitCode).toBe(0);
            downloadedDistros.push(instanceName);

            // Verify it appears in WSL list
            const listResult = await CommandBuilder.executeWSL(['--list', '--quiet'], { timeout: 5000 });
            expect(listResult.stdout).toContain(instanceName);

            console.log(`Successfully imported ${instanceName} to WSL`);
        });

        test('should run command in imported Alpine', async () => {
            if (downloadedDistros.length === 0) {
                console.warn('No distribution imported, skipping command test');
                return;
            }

            const instanceName = downloadedDistros[0];

            // Run a simple command
            const result = await CommandBuilder.executeWSL([
                '-d', instanceName,
                'cat', '/etc/os-release'
            ], { timeout: 10000 });

            expect(result.exitCode).toBe(0);
            expect(result.stdout.toLowerCase()).toContain('alpine');

            console.log('Successfully executed command in Alpine');
        });
    });

    describeReal('Download Error Handling', () => {
        test('should handle non-existent distro', async () => {
            await expect(downloader.downloadDistro('non-existent-distro-xyz'))
                .rejects
                .toThrow(/not found/i);
        });

        test('should handle invalid URL gracefully', async () => {
            // Add a distro with invalid URL
            const badDistro = {
                name: 'bad-url-test',
                displayName: 'Bad URL Test',
                description: 'Test distro with invalid URL',
                version: '1.0',
                architecture: 'x64' as const,
                sourceUrl: 'https://invalid.example.com/does-not-exist.tar.gz'
            };

            await distroManager.addDistro(badDistro, path.join(tempDir, 'fake.tar'));

            // Try to download
            await expect(downloader.downloadDistro('bad-url-test', {
                timeout: 10000 // Short timeout for test
            })).rejects.toThrow();
        });

        test('should handle network timeout', async () => {
            // Add a distro with slow/unresponsive URL
            const timeoutDistro = {
                name: 'timeout-test',
                displayName: 'Timeout Test',
                description: 'Test distro for timeout',
                version: '1.0',
                architecture: 'x64' as const,
                sourceUrl: 'https://httpstat.us/200?sleep=30000' // 30 second delay
            };

            await distroManager.addDistro(timeoutDistro, path.join(tempDir, 'fake2.tar'));

            // Try to download with short timeout
            await expect(downloader.downloadDistro('timeout-test', {
                timeout: 2000 // 2 second timeout
            })).rejects.toThrow(/timeout/i);
        });
    });

    describeReal('Full Workflow Test', () => {
        test('should complete full download -> import -> use workflow', async () => {
            jest.setTimeout(180000); // 3 minutes for full workflow

            const WORKFLOW_DISTRO = 'alpine-3.19';
            const instanceName = `workflow-test-${Date.now()}`;

            console.log('Starting full workflow test...');

            // Step 1: Download
            console.log('Step 1: Downloading distribution...');
            await downloader.downloadDistro(WORKFLOW_DISTRO, {
                onProgress: (p) => {
                    if (p.percent && p.percent % 25 === 0) {
                        console.log(`  Download: ${p.percent}%`);
                    }
                }
            });

            // Step 2: Verify download
            console.log('Step 2: Verifying download...');
            const distroPath = distroManager.getDistroPath(WORKFLOW_DISTRO);
            expect(fs.existsSync(distroPath)).toBe(true);

            // Step 3: Import to WSL
            console.log('Step 3: Importing to WSL...');
            const installPath = path.join(tempDir, 'workflow', instanceName);
            fs.mkdirSync(installPath, { recursive: true });

            const importResult = await CommandBuilder.executeWSL([
                '--import',
                instanceName,
                installPath,
                distroPath,
                '--version', '2'
            ], { timeout: 60000 });

            expect(importResult.exitCode).toBe(0);
            downloadedDistros.push(instanceName);

            // Step 4: Set up user
            console.log('Step 4: Setting up user...');
            const setupResult = await CommandBuilder.executeWSL([
                '-d', instanceName,
                '-u', 'root',
                'sh', '-c',
                'adduser -D testuser && echo "testuser:password" | chpasswd 2>/dev/null || true'
            ], { timeout: 10000 });

            // Step 5: Run test command
            console.log('Step 5: Running test command...');
            const testResult = await CommandBuilder.executeWSL([
                '-d', instanceName,
                'echo', 'Hello from WSL!'
            ], { timeout: 5000 });

            expect(testResult.exitCode).toBe(0);
            expect(testResult.stdout).toContain('Hello from WSL!');

            // Step 6: Export distribution
            console.log('Step 6: Exporting distribution...');
            const exportPath = path.join(tempDir, `${instanceName}-export.tar`);
            const exportResult = await CommandBuilder.executeWSL([
                '--export',
                instanceName,
                exportPath
            ], { timeout: 60000 });

            expect(exportResult.exitCode).toBe(0);
            expect(fs.existsSync(exportPath)).toBe(true);

            console.log('✅ Full workflow completed successfully!');
        });
    });
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}