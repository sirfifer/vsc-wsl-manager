/**
 * REAL Unit tests for DistroManager
 * Tests distribution catalog management with real file operations
 * NO MOCKS - Uses real file system and real catalog files
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { DistroManager, DistroInfo, DistroCatalog } from '../../../src/distros/DistroManager';

describe('DistroManager - Real Tests', () => {
    let tempDir: string;
    let distroManager: DistroManager;
    let testTarPath: string;

    beforeEach(() => {
        // Create a real temporary directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'distro-test-'));
        distroManager = new DistroManager(tempDir);

        // Create a small test TAR file for real testing
        testTarPath = path.join(tempDir, 'test-distro.tar');
        const testContent = Buffer.from('PK\x03\x04' + 'A'.repeat(1024)); // Small fake TAR content
        fs.writeFileSync(testTarPath, testContent);
    });

    afterEach(() => {
        // Clean up real temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Storage Directory Creation', () => {
        it('should create storage directories on initialization', () => {
            // Verify real directories were created
            const distrosPath = path.join(tempDir, 'distros');
            expect(fs.existsSync(distrosPath)).toBe(true);

            const stat = fs.statSync(distrosPath);
            expect(stat.isDirectory()).toBe(true);
        });

        it('should create catalog.json file', () => {
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');

            // Initially catalog might not exist
            distroManager.saveCatalog();

            expect(fs.existsSync(catalogPath)).toBe(true);

            // Read and verify real JSON content
            const content = fs.readFileSync(catalogPath, 'utf8');
            const catalog = JSON.parse(content);
            expect(catalog.version).toBeDefined();
            expect(Array.isArray(catalog.distributions)).toBe(true);
        });
    });

    describe('Distribution Management', () => {
        it('should add a distribution from a real TAR file', async () => {
            const distroInfo: DistroInfo = {
                name: 'alpine-test',
                displayName: 'Alpine Linux Test',
                description: 'Test Alpine distribution',
                version: '3.18',
                architecture: 'x64',
                filePath: testTarPath
            };

            const result = await distroManager.addDistribution(distroInfo);

            expect(result).toBeTruthy();
            expect(result.sha256).toBeDefined();
            expect(result.size).toBeGreaterThan(0);

            // Verify file was actually copied
            const copiedPath = path.join(tempDir, 'distros', 'alpine-test.tar');
            expect(fs.existsSync(copiedPath)).toBe(true);

            // Verify SHA256 hash is correct
            const fileContent = fs.readFileSync(copiedPath);
            const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
            expect(result.sha256).toBe(hash);
        });

        it('should list all available distributions', async () => {
            // Add multiple test distributions
            await distroManager.addDistribution({
                name: 'ubuntu-test',
                displayName: 'Ubuntu Test',
                description: 'Test Ubuntu',
                version: '22.04',
                architecture: 'x64',
                filePath: testTarPath
            });

            await distroManager.addDistribution({
                name: 'debian-test',
                displayName: 'Debian Test',
                description: 'Test Debian',
                version: '12',
                architecture: 'x64',
                filePath: testTarPath
            });

            const distributions = distroManager.listDistributions();

            expect(distributions).toHaveLength(2);
            expect(distributions.some(d => d.name === 'ubuntu-test')).toBe(true);
            expect(distributions.some(d => d.name === 'debian-test')).toBe(true);

            // All should be available since we added them
            distributions.forEach(distro => {
                expect(distro.available).toBe(true);
            });
        });

        it('should remove a distribution and delete its file', async () => {
            await distroManager.addDistribution({
                name: 'to-remove',
                displayName: 'To Remove',
                description: 'Will be removed',
                version: '1.0',
                architecture: 'x64',
                filePath: testTarPath
            });

            const filePath = path.join(tempDir, 'distros', 'to-remove.tar');
            expect(fs.existsSync(filePath)).toBe(true);

            const removed = await distroManager.removeDistribution('to-remove');

            expect(removed).toBe(true);
            expect(fs.existsSync(filePath)).toBe(false);

            const distributions = distroManager.listDistributions();
            expect(distributions.some(d => d.name === 'to-remove')).toBe(false);
        });

        it('should verify distribution integrity with SHA256', async () => {
            const distro = await distroManager.addDistribution({
                name: 'verify-test',
                displayName: 'Verify Test',
                description: 'For verification',
                version: '1.0',
                architecture: 'x64',
                filePath: testTarPath
            });

            const isValid = await distroManager.verifyDistribution('verify-test');
            expect(isValid).toBe(true);

            // Corrupt the file
            const corruptPath = path.join(tempDir, 'distros', 'verify-test.tar');
            fs.appendFileSync(corruptPath, 'CORRUPTED');

            const isCorrupted = await distroManager.verifyDistribution('verify-test');
            expect(isCorrupted).toBe(false);
        });

        it('should get distribution file path', async () => {
            await distroManager.addDistribution({
                name: 'path-test',
                displayName: 'Path Test',
                description: 'For path testing',
                version: '1.0',
                architecture: 'x64',
                filePath: testTarPath
            });

            const distroPath = distroManager.getDistributionPath('path-test');

            expect(distroPath).toBeDefined();
            expect(fs.existsSync(distroPath!)).toBe(true);
            expect(distroPath).toContain('path-test.tar');
        });
    });

    describe('Catalog Persistence', () => {
        it('should persist catalog to disk and reload it', async () => {
            // Add distributions
            await distroManager.addDistribution({
                name: 'persist-test',
                displayName: 'Persist Test',
                description: 'Testing persistence',
                version: '1.0',
                architecture: 'arm64',
                tags: ['test', 'alpine'],
                filePath: testTarPath
            });

            // Save catalog
            distroManager.saveCatalog();

            // Create new instance to test loading
            const newManager = new DistroManager(tempDir);
            const distributions = newManager.listDistributions();

            expect(distributions).toHaveLength(1);
            const loaded = distributions[0];
            expect(loaded.name).toBe('persist-test');
            expect(loaded.architecture).toBe('arm64');
            expect(loaded.tags).toContain('test');
            expect(loaded.tags).toContain('alpine');
        });

        it('should handle missing catalog file gracefully', () => {
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            if (fs.existsSync(catalogPath)) {
                fs.unlinkSync(catalogPath);
            }

            // Should not throw
            const newManager = new DistroManager(tempDir);
            const distributions = newManager.listDistributions();

            expect(distributions).toEqual([]);
        });

        it('should handle corrupted catalog file', () => {
            const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
            fs.writeFileSync(catalogPath, 'INVALID JSON {{{');

            // Should not throw, should initialize with empty catalog
            const newManager = new DistroManager(tempDir);
            const distributions = newManager.listDistributions();

            expect(distributions).toEqual([]);
        });
    });

    describe('Distribution Discovery', () => {
        it('should discover TAR files in distros directory', () => {
            // Manually place TAR files
            const distrosPath = path.join(tempDir, 'distros');
            fs.copyFileSync(testTarPath, path.join(distrosPath, 'manual1.tar'));
            fs.copyFileSync(testTarPath, path.join(distrosPath, 'manual2.tar'));

            // Also create a non-TAR file that should be ignored
            fs.writeFileSync(path.join(distrosPath, 'readme.txt'), 'Not a TAR');

            const discovered = distroManager.discoverDistributions();

            // Should find the manually placed TAR files
            expect(discovered.length).toBeGreaterThanOrEqual(2);
            expect(discovered.some(f => f.includes('manual1.tar'))).toBe(true);
            expect(discovered.some(f => f.includes('manual2.tar'))).toBe(true);
            expect(discovered.some(f => f.includes('readme.txt'))).toBe(false);
        });

        it('should check if distribution is available locally', async () => {
            await distroManager.addDistribution({
                name: 'available-test',
                displayName: 'Available Test',
                description: 'Testing availability',
                version: '1.0',
                architecture: 'x64',
                filePath: testTarPath
            });

            expect(distroManager.isAvailable('available-test')).toBe(true);
            expect(distroManager.isAvailable('non-existent')).toBe(false);

            // Remove the file but keep in catalog
            const filePath = path.join(tempDir, 'distros', 'available-test.tar');
            fs.unlinkSync(filePath);

            expect(distroManager.isAvailable('available-test')).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle adding distribution with non-existent file', async () => {
            const result = await distroManager.addDistribution({
                name: 'missing-file',
                displayName: 'Missing File',
                description: 'File does not exist',
                version: '1.0',
                architecture: 'x64',
                filePath: '/non/existent/file.tar'
            });

            expect(result).toBeNull();
        });

        it('should handle removing non-existent distribution', async () => {
            const removed = await distroManager.removeDistribution('does-not-exist');
            expect(removed).toBe(false);
        });

        it('should prevent duplicate distribution names', async () => {
            await distroManager.addDistribution({
                name: 'duplicate',
                displayName: 'First',
                description: 'First version',
                version: '1.0',
                architecture: 'x64',
                filePath: testTarPath
            });

            const duplicate = await distroManager.addDistribution({
                name: 'duplicate',
                displayName: 'Second',
                description: 'Should fail',
                version: '2.0',
                architecture: 'x64',
                filePath: testTarPath
            });

            expect(duplicate).toBeNull();

            // Verify only first one exists
            const distributions = distroManager.listDistributions();
            const found = distributions.filter(d => d.name === 'duplicate');
            expect(found).toHaveLength(1);
            expect(found[0].displayName).toBe('First');
        });
    });

    describe('Real File Operations', () => {
        it('should calculate correct file sizes', async () => {
            // Create files with known sizes
            const smallFile = path.join(tempDir, 'small.tar');
            const largeFile = path.join(tempDir, 'large.tar');

            fs.writeFileSync(smallFile, Buffer.alloc(1024)); // 1KB
            fs.writeFileSync(largeFile, Buffer.alloc(1024 * 1024)); // 1MB

            const small = await distroManager.addDistribution({
                name: 'small',
                displayName: 'Small',
                description: 'Small file',
                version: '1.0',
                architecture: 'x64',
                filePath: smallFile
            });

            const large = await distroManager.addDistribution({
                name: 'large',
                displayName: 'Large',
                description: 'Large file',
                version: '1.0',
                architecture: 'x64',
                filePath: largeFile
            });

            expect(small?.size).toBe(1024);
            expect(large?.size).toBe(1024 * 1024);
        });

        it('should handle filesystem permission errors gracefully', () => {
            if (process.platform === 'win32') {
                // Skip on Windows as permissions work differently
                return;
            }

            const restrictedPath = '/root/test-distros';

            // Should not throw even with permission denied
            expect(() => {
                new DistroManager(restrictedPath);
            }).not.toThrow();
        });
    });
});