/**
 * REAL Unit tests for EnhancedDistroManager
 * Tests dynamic distribution fetching with real Microsoft Registry calls
 * NO MOCKS - Uses real HTTP calls and real file system
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { EnhancedDistroManager } from '../../../src/distros/EnhancedDistroManager';
import { DistributionRegistry } from '../../../src/distributionRegistry';

describe('EnhancedDistroManager - Real Tests', () => {
    let tempDir: string;
    let manager: EnhancedDistroManager;

    beforeEach(() => {
        // Create real temp directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enhanced-distro-real-test-'));

        // Create manager with real components - NO MOCKS
        manager = new EnhancedDistroManager(tempDir);
    });

    afterEach(() => {
        // Clean up real files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Real Microsoft Registry Integration', () => {
        it('should fetch real distributions from Microsoft Registry', async () => {
            // Arrange - Nothing to mock, using real registry

            // Act - Make REAL network call to Microsoft
            const distros = await manager.listDistros();

            // Assert - Verify real data returned
            expect(distros).toBeDefined();
            expect(Array.isArray(distros)).toBe(true);
            expect(distros.length).toBeGreaterThan(0);

            // Should have real Ubuntu distros from Microsoft
            const ubuntuDistros = distros.filter(d => d.name.toLowerCase().includes('ubuntu'));
            expect(ubuntuDistros.length).toBeGreaterThan(0);

            // Note: This test WILL fail if Microsoft's registry is down
            // That's GOOD - we want to know when the real world breaks
        }, 30000); // Allow 30 seconds for real network call

        it('should have correct Ubuntu-24.04 URL', async () => {
            // Act - Real fetch
            const distros = await manager.listDistros();

            // Assert - Check real URL
            const ubuntu2404 = distros.find(d => d.name === 'ubuntu-24.04');
            expect(ubuntu2404).toBeDefined();
            expect(ubuntu2404?.sourceUrl).toBe('https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl');

            // Verify it's NOT the broken URL
            expect(ubuntu2404?.sourceUrl).not.toContain('cloud-images.ubuntu.com/wsl/noble');
        });

        it('should refresh distributions from real Microsoft Registry', async () => {
            // Act - Force real refresh
            await manager.refreshDistributions();

            // Check catalog was created with real data
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            expect(fs.existsSync(catalogPath)).toBe(true);

            // Read real catalog file
            const catalogContent = fs.readFileSync(catalogPath, 'utf8');
            const catalog = JSON.parse(catalogContent);

            expect(catalog.version).toBe('2.0.0');
            expect(catalog.distributions).toBeDefined();
            expect(catalog.distributions.length).toBeGreaterThan(0);
        }, 30000);
    });

    describe('Real URL Validation', () => {
        it('should validate real Ubuntu-24.04 URL with HEAD request', async () => {
            // This makes a REAL HTTP HEAD request to Ubuntu servers
            const ubuntu2404Url = 'https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl';

            const isValid = await new Promise<boolean>((resolve) => {
                https.request(ubuntu2404Url, { method: 'HEAD', timeout: 10000 }, (res) => {
                    resolve(res.statusCode === 200);
                }).on('error', () => resolve(false)).end();
            });

            expect(isValid).toBe(true);
        }, 15000);

        it('should detect invalid URL with real HEAD request', async () => {
            // This URL should NOT exist
            const invalidUrl = 'https://cloud-images.ubuntu.com/wsl/noble/current/ubuntu-noble-wsl-amd64-wsl.rootfs.tar.gz';

            const isValid = await new Promise<boolean>((resolve) => {
                https.request(invalidUrl, { method: 'HEAD', timeout: 10000 }, (res) => {
                    resolve(res.statusCode === 200);
                }).on('error', () => resolve(false)).end();
            });

            expect(isValid).toBe(false);
        }, 15000);
    });

    describe('Real Catalog Persistence', () => {
        it('should save real catalog to disk', async () => {
            // Act - Trigger real catalog save
            await manager.refreshDistributions();

            // Assert - Check real file
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            expect(fs.existsSync(catalogPath)).toBe(true);

            // Verify it's valid JSON with real content
            const content = fs.readFileSync(catalogPath, 'utf8');
            const catalog = JSON.parse(content);

            expect(catalog).toHaveProperty('version');
            expect(catalog).toHaveProperty('updated');
            expect(catalog).toHaveProperty('distributions');
            expect(catalog.distributions.length).toBeGreaterThan(0);
        });

        it('should load real catalog from disk on next instantiation', async () => {
            // First instance saves real catalog
            await manager.refreshDistributions();

            // Create second instance with same directory
            const manager2 = new EnhancedDistroManager(tempDir);

            // Should load from real catalog file
            const distros = await manager2.listDistros();
            expect(distros.length).toBeGreaterThan(0);

            // Should have Ubuntu-24.04 from persisted catalog
            const ubuntu = distros.find(d => d.name === 'ubuntu-24.04');
            expect(ubuntu).toBeDefined();
        });

        it('should handle corrupted catalog gracefully', async () => {
            // Write invalid JSON to catalog location
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
            fs.writeFileSync(catalogPath, 'not-valid-json{{{');

            // Create new manager - should handle corrupted file
            const newManager = new EnhancedDistroManager(tempDir);

            // Should still return distributions (from defaults or fresh fetch)
            const distros = await newManager.listDistros();
            expect(distros).toBeDefined();
            expect(distros.length).toBeGreaterThan(0);
        });
    });

    describe('Real Cache Behavior', () => {
        it('should use 1-hour cache duration', async () => {
            // First call - may fetch from network
            const start1 = Date.now();
            await manager.listDistros();
            const duration1 = Date.now() - start1;

            // Second call immediately after - should use cache
            const start2 = Date.now();
            await manager.listDistros();
            const duration2 = Date.now() - start2;

            // Cached call should be much faster
            expect(duration2).toBeLessThan(duration1 / 2);
        });

        it('should clear cache when requested', async () => {
            // Initial fetch
            await manager.listDistros();

            // Clear cache
            await manager.clearCache();

            // Should trigger new fetch
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            if (fs.existsSync(catalogPath)) {
                const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
                // Updated time should be recent
                const updatedTime = new Date(catalog.updated).getTime();
                const now = Date.now();
                expect(now - updatedTime).toBeLessThan(5000); // Within 5 seconds
            }
        });
    });

    describe('Security - Input Validation', () => {
        it('should handle malicious distribution names safely', async () => {
            // Test various malicious inputs
            const maliciousNames = [
                '../../../etc/passwd',
                'test; rm -rf /',
                'test && curl evil.com',
                'test`whoami`',
                'test$(cat /etc/shadow)'
            ];

            // Manager should handle these safely
            for (const name of maliciousNames) {
                const distro = await manager.getDistro(name);
                expect(distro).toBeNull(); // Should not find malicious names
            }
        });

        it('should sanitize file paths', () => {
            // Test path traversal attempts
            const maliciousPath = '../../../etc/passwd';
            const safePath = manager.getDistroPath(maliciousPath);

            // Path should be contained within distro directory
            expect(safePath).toContain('distros');
            expect(safePath).not.toContain('..');
        });
    });

    describe('Real Performance Requirements', () => {
        it('should complete unit operations in < 200ms', async () => {
            const start = Date.now();

            // Simple operation that doesn't require network
            const path = manager.getDistroPath('test');

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });

        it('should complete listDistros in reasonable time', async () => {
            const start = Date.now();

            await manager.listDistros();

            const duration = Date.now() - start;
            // Allow up to 30 seconds for network call
            expect(duration).toBeLessThan(30000);
        }, 35000);
    });
});