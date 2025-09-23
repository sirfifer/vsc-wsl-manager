/**
 * Integration Test: Debian APPX Download
 * Tests the full flow of downloading Debian from Microsoft Registry
 * which provides an AppxBundle URL that needs extraction
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DistroDownloader } from '../../src/distros/DistroDownloader';
import { EnhancedDistroManager } from '../../src/distros/EnhancedDistroManager';
import { DistributionRegistry } from '../../src/distributionRegistry';

describe('Debian APPX Download Integration', () => {
    let tempDir: string;
    let manager: EnhancedDistroManager;
    let downloader: DistroDownloader;
    let registry: DistributionRegistry;

    beforeEach(() => {
        // Create temp directory for downloads
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debian-test-'));
        manager = new EnhancedDistroManager(tempDir);
        downloader = new DistroDownloader(manager);
        registry = new DistributionRegistry();
    });

    afterEach(() => {
        // Clean up
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should download and extract Debian from Microsoft Registry APPX URL', async function() {
        // Skip in CI to avoid large downloads
        if (process.env.CI) {
            this.skip();
            return;
        }

        // This test may take a while for actual download
        this.timeout(120000); // 2 minutes

        // Fetch distributions from Microsoft Registry
        const msDistros = await registry.fetchAvailableDistributions();
        const debianFromRegistry = msDistros.find(d =>
            d.Name.toLowerCase() === 'debian' ||
            d.Name.toLowerCase().includes('debian')
        );

        // Ensure Debian is in registry
        expect(debianFromRegistry).toBeDefined();
        expect(debianFromRegistry?.Amd64PackageUrl).toBeDefined();

        // Verify it's an APPX/AppxBundle URL
        const url = debianFromRegistry!.Amd64PackageUrl!;
        expect(url).toMatch(/\.(appx|appxbundle)$/i);

        console.log(`Testing Debian download from: ${url}`);

        // Create a distro info object
        const debianDistro = {
            name: 'debian-test',
            displayName: 'Debian Test',
            description: 'Test Debian download with APPX extraction',
            version: '12',
            architecture: 'x64' as const,
            sourceUrl: url,
            tags: ['debian', 'test'],
            size: 100 * 1024 * 1024, // Estimate
            available: false
        };

        // Download with progress tracking
        const progressUpdates: any[] = [];
        await downloader.downloadDistro('debian-test', {
            distro: debianDistro,
            onProgress: (progress) => {
                progressUpdates.push({
                    percent: progress.percent,
                    downloaded: progress.downloaded,
                    total: progress.total
                });

                // Log every 10%
                if (progress.percent % 10 === 0) {
                    console.log(`Download progress: ${progress.percent}%`);
                }
            }
        });

        // Verify download completed
        const targetPath = path.join(tempDir, 'distros', 'debian-test.tar');
        expect(fs.existsSync(targetPath)).toBe(true);

        // Verify it's a TAR file (not an APPX)
        const stats = fs.statSync(targetPath);
        expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // Should be > 10MB

        // Verify TAR file structure
        const buffer = Buffer.alloc(512);
        const fd = fs.openSync(targetPath, 'r');
        fs.readSync(fd, buffer, 0, 512, 0);
        fs.closeSync(fd);

        // Check for TAR header or gzip magic
        const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
        const isTar = buffer.toString('ascii', 0, 100).match(/^[\x00-\x7F]*$/);
        expect(isGzip || isTar).toBe(true);

        // Verify progress was tracked
        expect(progressUpdates.length).toBeGreaterThan(0);
        const lastProgress = progressUpdates[progressUpdates.length - 1];
        expect(lastProgress.percent).toBe(100);

        console.log('Debian APPX download and extraction successful!');
    }, 120000);

    it('should handle Debian URL replacement from registry', async () => {
        // Get initial catalog
        const catalog = manager.getUpdatedDefaultDistros();
        const debianFromCatalog = catalog.find(d => d.name === 'debian-12');

        expect(debianFromCatalog).toBeDefined();
        const originalUrl = debianFromCatalog!.sourceUrl;

        // Should start with GitHub tar.xz URL
        expect(originalUrl).toMatch(/\.tar\.xz$/);

        // Refresh from registry (this should update URLs)
        await manager.refreshDistributions();

        // Get updated catalog
        const updatedCatalog = manager.getUpdatedDefaultDistros();
        const updatedDebian = updatedCatalog.find(d => d.name === 'debian-12');

        // URL might be updated to Microsoft's APPX URL
        // (depends on whether registry fetch succeeds)
        expect(updatedDebian).toBeDefined();

        // If URL changed, it should be to an APPX
        if (updatedDebian!.sourceUrl !== originalUrl) {
            expect(updatedDebian!.sourceUrl).toMatch(/\.(appx|appxbundle)$/i);
        }
    });

    it('should detect APPX files correctly based on URL extension', () => {
        const testUrls = [
            { url: 'https://example.com/debian.appx', isAppx: true },
            { url: 'https://example.com/debian.AppxBundle', isAppx: true },
            { url: 'https://example.com/debian.tar.gz', isAppx: false },
            { url: 'https://example.com/debian.tar.xz', isAppx: false },
            { url: 'https://blob.core.windows.net/storage/Debian.AppxBundle?sv=2022', isAppx: true }
        ];

        for (const test of testUrls) {
            const urlPath = new URL(test.url).pathname;
            const ext = path.extname(urlPath).toLowerCase();
            const isAppx = ext === '.appx' || ext === '.appxbundle';

            expect(isAppx).toBe(test.isAppx);
        }
    });
});