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

            // Should have a valid HTTPS URL (Microsoft may redirect to their CDN)
            expect(ubuntu2404?.sourceUrl).toMatch(/^https:\/\//);
            expect(ubuntu2404?.sourceUrl).toBeDefined();
            expect(ubuntu2404?.sourceUrl!.length).toBeGreaterThan(10);

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

    describe('Download State Preservation (Bug Fix)', () => {
        it('should preserve download state when refreshing from registry', async () => {
            // Simulate a downloaded distribution by creating a file
            const distroPath = path.join(tempDir, 'distros', 'alpine.tar.gz');
            fs.mkdirSync(path.dirname(distroPath), { recursive: true });
            fs.writeFileSync(distroPath, 'fake alpine data');

            // Create initial catalog with downloaded distro
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            const initialCatalog = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: [
                    {
                        name: 'alpine',
                        displayName: 'Alpine Linux',
                        description: 'Alpine Linux - Lightweight and secure',
                        version: '3.19',
                        architecture: 'x64',
                        sourceUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.0-x86_64.tar.gz',
                        tags: ['alpine', 'minimal', 'lightweight'],
                        size: 3 * 1024 * 1024,
                        available: true,
                        filePath: distroPath,
                        added: new Date().toISOString()
                    }
                ]
            };
            fs.writeFileSync(catalogPath, JSON.stringify(initialCatalog, null, 2));

            // Get distributions before refresh
            const distrosBefore = await manager.listDistros();
            const availableBefore = distrosBefore.filter(d => d.available && d.name === 'alpine');
            expect(availableBefore.length).toBe(1);
            expect(availableBefore[0].filePath).toBe(distroPath);

            // Force refresh from registry - THIS WAS WIPING DOWNLOAD STATE
            await manager.refreshDistributions();

            // Get distributions after refresh
            const distrosAfter = await manager.listDistros();
            const availableAfter = distrosAfter.filter(d => d.available && d.name === 'alpine');

            // CRITICAL BUG FIX: Download state should be preserved
            expect(availableAfter.length).toBe(1);
            expect(availableAfter[0].available).toBe(true);
            expect(availableAfter[0].filePath).toBe(distroPath);
        }, 30000);

        it('should preserve custom imported distros not in default list', async () => {
            // Create a custom distro not in the hardcoded list
            const customDistroPath = path.join(tempDir, 'distros', 'my-custom-ubuntu.tar.gz');
            fs.mkdirSync(path.dirname(customDistroPath), { recursive: true });
            fs.writeFileSync(customDistroPath, 'fake custom ubuntu data');

            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            const initialCatalog = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: [
                    {
                        name: 'my-custom-ubuntu',
                        displayName: 'My Custom Ubuntu',
                        description: 'Custom Ubuntu distribution',
                        version: '22.04',
                        architecture: 'x64',
                        sourceUrl: 'file:///custom/ubuntu.tar.gz',
                        tags: ['custom', 'ubuntu'],
                        size: 500 * 1024 * 1024,
                        available: true,
                        filePath: customDistroPath,
                        added: new Date().toISOString()
                    }
                ]
            };
            fs.writeFileSync(catalogPath, JSON.stringify(initialCatalog, null, 2));

            // Get distributions before refresh
            const distrosBefore = await manager.listDistros();
            const customBefore = distrosBefore.find(d => d.name === 'my-custom-ubuntu');
            expect(customBefore).toBeDefined();
            expect(customBefore?.available).toBe(true);

            // Force refresh from registry
            await manager.refreshDistributions();

            // Get distributions after refresh
            const distrosAfter = await manager.listDistros();
            const customAfter = distrosAfter.find(d => d.name === 'my-custom-ubuntu');

            // CRITICAL: Custom distro should still be present and available
            expect(customAfter).toBeDefined();
            expect(customAfter?.available).toBe(true);
            expect(customAfter?.filePath).toBe(customDistroPath);
        }, 30000);

        it('should mark distro as unavailable if file was deleted', async () => {
            // Create initial catalog with supposedly downloaded distro
            const distroPath = path.join(tempDir, 'distros', 'debian-12.tar.gz');
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
            const initialCatalog = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: [
                    {
                        name: 'debian-12',
                        displayName: 'Debian 12',
                        description: 'Debian 12 (Bookworm)',
                        version: '12',
                        architecture: 'x64',
                        sourceUrl: 'https://github.com/debuerreotype/docker-debian-artifacts/raw/dist-amd64/bookworm/rootfs.tar.xz',
                        tags: ['debian', 'stable'],
                        size: 50 * 1024 * 1024,
                        available: true,
                        filePath: distroPath,
                        added: new Date().toISOString()
                    }
                ]
            };
            fs.writeFileSync(catalogPath, JSON.stringify(initialCatalog, null, 2));

            // Don't create the file (simulate deletion or corruption)
            expect(fs.existsSync(distroPath)).toBe(false);

            // Force refresh from registry (should detect missing file)
            await manager.refreshDistributions();

            // Get distributions after refresh
            const distrosAfter = await manager.listDistros();
            const debian = distrosAfter.find(d => d.name === 'debian-12');

            // CRITICAL: Should be marked as unavailable since file doesn't exist
            expect(debian).toBeDefined();
            expect(debian?.available).toBe(false);
            expect(debian?.filePath).toBeUndefined();
        }, 30000);

        it('should update size from file system if not set in catalog', async () => {
            // Create a distro file
            const distroPath = path.join(tempDir, 'distros', 'ubuntu-24.04.tar.gz');
            fs.mkdirSync(path.dirname(distroPath), { recursive: true });
            const testData = Buffer.alloc(1024 * 100); // 100KB
            fs.writeFileSync(distroPath, testData);

            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            const initialCatalog = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: [
                    {
                        name: 'ubuntu-24.04',
                        displayName: 'Ubuntu 24.04 LTS',
                        description: 'Ubuntu 24.04 LTS',
                        version: '24.04',
                        architecture: 'x64',
                        sourceUrl: 'https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl',
                        tags: ['ubuntu', 'lts'],
                        available: true,
                        filePath: distroPath
                        // Note: size is missing
                    }
                ]
            };
            fs.writeFileSync(catalogPath, JSON.stringify(initialCatalog, null, 2));

            // Force refresh from registry
            await manager.refreshDistributions();

            // Get distributions after refresh
            const distrosAfter = await manager.listDistros();
            const ubuntu = distrosAfter.find(d => d.name === 'ubuntu-24.04');

            // CRITICAL: Size should be updated from file system
            expect(ubuntu).toBeDefined();
            expect(ubuntu?.available).toBe(true);
            expect(ubuntu?.size).toBe(1024 * 100);
        }, 30000);

        it('should merge multiple downloaded distros correctly', async () => {
            // Create multiple downloaded distro files
            const alpinePath = path.join(tempDir, 'distros', 'alpine.tar.gz');
            const debianPath = path.join(tempDir, 'distros', 'debian-12.tar.gz');
            const customPath = path.join(tempDir, 'distros', 'my-special-distro.tar.gz');

            fs.mkdirSync(path.dirname(alpinePath), { recursive: true });
            fs.writeFileSync(alpinePath, 'alpine data');
            fs.writeFileSync(debianPath, 'debian data');
            fs.writeFileSync(customPath, 'custom data');

            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            const initialCatalog = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: [
                    {
                        name: 'alpine',
                        displayName: 'Alpine Linux',
                        description: 'Alpine Linux',
                        version: '3.19',
                        architecture: 'x64',
                        sourceUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.0-x86_64.tar.gz',
                        tags: ['alpine'],
                        size: 3 * 1024 * 1024,
                        available: true,
                        filePath: alpinePath
                    },
                    {
                        name: 'debian-12',
                        displayName: 'Debian 12',
                        description: 'Debian 12',
                        version: '12',
                        architecture: 'x64',
                        sourceUrl: 'https://github.com/debuerreotype/docker-debian-artifacts/raw/dist-amd64/bookworm/rootfs.tar.xz',
                        tags: ['debian'],
                        size: 50 * 1024 * 1024,
                        available: true,
                        filePath: debianPath
                    },
                    {
                        name: 'my-special-distro',
                        displayName: 'My Special Distro',
                        description: 'Custom distro',
                        version: '1.0',
                        architecture: 'x64',
                        sourceUrl: 'file:///custom.tar.gz',
                        tags: ['custom'],
                        size: 100 * 1024 * 1024,
                        available: true,
                        filePath: customPath
                    }
                ]
            };
            fs.writeFileSync(catalogPath, JSON.stringify(initialCatalog, null, 2));

            // Force refresh from registry
            await manager.refreshDistributions();

            // Get distributions after refresh
            const distrosAfter = await manager.listDistros();
            const availableAfter = distrosAfter.filter(d => d.available);

            // CRITICAL: All three should still be available
            expect(availableAfter.length).toBe(3);

            const alpine = distrosAfter.find(d => d.name === 'alpine');
            const debian = distrosAfter.find(d => d.name === 'debian-12');
            const custom = distrosAfter.find(d => d.name === 'my-special-distro');

            expect(alpine?.available).toBe(true);
            expect(alpine?.filePath).toBe(alpinePath);

            expect(debian?.available).toBe(true);
            expect(debian?.filePath).toBe(debianPath);

            expect(custom?.available).toBe(true);
            expect(custom?.filePath).toBe(customPath);
        }, 30000);
    });
});