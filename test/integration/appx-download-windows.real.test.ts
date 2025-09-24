/**
 * Real APPX Download Tests for Windows
 * Tests actual downloads from Microsoft Store URLs that failed in production
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EnhancedDistroManager } from '../../src/distros/EnhancedDistroManager';
import { DistroDownloader } from '../../src/distros/DistroDownloader';
import { DistributionRegistry } from '../../src/distributionRegistry';

describe('Real APPX Download on Windows', () => {
    let tempDir: string;
    let manager: EnhancedDistroManager;
    let downloader: DistroDownloader;
    let registry: DistributionRegistry;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appx-download-test-'));
        manager = new EnhancedDistroManager(tempDir);
        downloader = new DistroDownloader(manager);
        registry = new DistributionRegistry();
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('APPX Extraction on Windows', () => {
        it('should extract TAR from real Debian APPX', async function() {
            // Skip in CI unless explicitly testing Windows
            if (process.env.CI && process.env.RUNNER_OS !== 'Windows') {
                this.skip();
                return;
            }

            this.timeout(180000); // 3 minutes for download

            // Get real Debian URL from Microsoft Registry
            const distributions = await registry.fetchAvailableDistributions();
            const debian = distributions.find(d =>
                d.Name.toLowerCase() === 'debian' ||
                d.Name.toLowerCase().includes('debian')
            );

            if (!debian || !debian.Amd64PackageUrl) {
                this.skip();
                return;
            }

            console.log(`Testing Debian APPX download from: ${debian.Amd64PackageUrl}`);

            // Create distro info
            const debianDistro = {
                name: 'debian-test',
                displayName: 'Debian Test',
                description: 'Test Debian APPX extraction',
                version: '12',
                architecture: 'x64' as const,
                sourceUrl: debian.Amd64PackageUrl,
                tags: ['debian', 'test'],
                size: 100 * 1024 * 1024,
                available: false
            };

            // Track progress
            const progressUpdates: any[] = [];

            // Download and extract
            await downloader.downloadDistro('debian-test', {
                distro: debianDistro,
                onProgress: (progress) => {
                    progressUpdates.push(progress);
                    if (progress.percent % 20 === 0) {
                        console.log(`Download: ${progress.percent}% (${progress.downloaded}/${progress.total})`);
                    }
                }
            });

            // Verify extraction succeeded
            const targetPath = manager.getDistroPath('debian-test');
            expect(fs.existsSync(targetPath)).toBe(true);

            // Verify it's a TAR file, not an APPX
            const stats = fs.statSync(targetPath);
            expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // > 10MB

            // Check file header
            const buffer = Buffer.alloc(512);
            const fd = fs.openSync(targetPath, 'r');
            fs.readSync(fd, buffer, 0, 512, 0);
            fs.closeSync(fd);

            // Should be TAR or GZIP, not ZIP/APPX (PK header)
            const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;
            expect(isZip).toBe(false);
        });

        it('should handle Kali Linux APPX download', async function() {
            if (process.env.CI && process.env.RUNNER_OS !== 'Windows') {
                this.skip();
                return;
            }

            this.timeout(180000);

            const distributions = await registry.fetchAvailableDistributions();
            const kali = distributions.find(d =>
                d.Name.toLowerCase().includes('kali')
            );

            if (!kali || !kali.Amd64PackageUrl) {
                this.skip();
                return;
            }

            const kaliDistro = {
                name: 'kali-test',
                displayName: 'Kali Test',
                description: 'Test Kali APPX extraction',
                version: '2024.1',
                architecture: 'x64' as const,
                sourceUrl: kali.Amd64PackageUrl,
                tags: ['kali', 'test'],
                size: 200 * 1024 * 1024,
                available: false
            };

            await downloader.downloadDistro('kali-test', {
                distro: kaliDistro
            });

            const targetPath = manager.getDistroPath('kali-test');
            expect(fs.existsSync(targetPath)).toBe(true);
        });

        it('should handle Alpine tar.gz download (non-APPX)', async function() {
            if (process.env.CI && process.env.RUNNER_OS !== 'Windows') {
                this.skip();
                return;
            }

            this.timeout(60000);

            // Alpine uses direct TAR.GZ, not APPX
            const alpineUrl = 'https://dl-cdn.alpinelinux.org/alpine/v3.18/releases/x86_64/alpine-minirootfs-3.18.0-x86_64.tar.gz';

            const alpineDistro = {
                name: 'alpine-test',
                displayName: 'Alpine Test',
                description: 'Test Alpine direct download',
                version: '3.18',
                architecture: 'x64' as const,
                sourceUrl: alpineUrl,
                tags: ['alpine', 'test'],
                size: 3 * 1024 * 1024,
                available: false
            };

            await downloader.downloadDistro('alpine-test', {
                distro: alpineDistro
            });

            const targetPath = manager.getDistroPath('alpine-test');
            expect(fs.existsSync(targetPath)).toBe(true);

            // Alpine should NOT go through APPX extraction
            const stats = fs.statSync(targetPath);
            expect(stats.size).toBeGreaterThan(2 * 1024 * 1024);
            expect(stats.size).toBeLessThan(5 * 1024 * 1024);
        });
    });

    describe('Platform Detection in APPX Extraction', () => {
        it('should detect Windows tar.exe availability', async () => {
            const { CrossPlatformCommandExecutor } = require('../../src/utils/commandExecutor');
            const executor = new CrossPlatformCommandExecutor();

            const hasTar = await executor.isCommandAvailable('tar.exe');

            // On Windows 10/11, tar.exe should be available
            if (process.platform === 'win32') {
                expect(hasTar).toBe(true);
            }
        });

        it('should use correct extraction command on Windows', async () => {
            // Create a mock APPX (ZIP file)
            const mockAppx = path.join(tempDir, 'test.appx');
            const testContent = Buffer.from('PK\x03\x04'); // ZIP header
            fs.writeFileSync(mockAppx, testContent);

            const { CrossPlatformCommandExecutor } = require('../../src/utils/commandExecutor');
            const executor = new CrossPlatformCommandExecutor();

            // Check which command would be used
            const hasTar = await executor.isCommandAvailable('tar.exe');
            const hasUnzip = await executor.isCommandAvailable('unzip');

            if (process.platform === 'win32') {
                expect(hasTar || hasUnzip).toBe(true);
            }
        });
    });

    describe('Error Scenarios', () => {
        it('should handle APPX with no TAR inside', async () => {
            // Create a mock APPX with no TAR
            const mockAppxPath = path.join(tempDir, 'no-tar.appx');

            // Create a simple ZIP with just a text file
            const content = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00'); // Basic ZIP
            fs.writeFileSync(mockAppxPath, content);

            const targetPath = path.join(tempDir, 'extracted.tar');

            // Access private method for testing
            const extractMethod = (downloader as any).extractTarFromAppx;
            const result = await extractMethod.call(downloader, mockAppxPath, targetPath);

            expect(result).toBeNull();
            expect(fs.existsSync(targetPath)).toBe(false);
        });

        it('should handle download interruption gracefully', async () => {
            // Use a URL that will timeout
            const slowUrl = 'https://httpbin.org/delay/30';

            const testDistro = {
                name: 'timeout-test',
                displayName: 'Timeout Test',
                description: 'Test timeout handling',
                version: '1.0',
                architecture: 'x64' as const,
                sourceUrl: slowUrl,
                tags: ['test'],
                size: 1024,
                available: false
            };

            await expect(
                downloader.downloadDistro('timeout-test', {
                    distro: testDistro,
                    timeout: 1000 // 1 second timeout
                })
            ).rejects.toThrow();
        });
    });

    describe('Storage Path Verification', () => {
        it('should save to correct directory, not VS Code program directory', async () => {
            const distroPath = manager.getDistroPath('test');

            // Should be in our temp directory
            expect(distroPath).toContain(tempDir);

            // Should NOT be in Program Files
            expect(distroPath).not.toContain('Program Files');
            expect(distroPath).not.toContain('Microsoft VS Code');

            // Should have correct structure
            expect(distroPath).toContain('distros');
            expect(distroPath).toContain('test.tar');
        });
    });
});