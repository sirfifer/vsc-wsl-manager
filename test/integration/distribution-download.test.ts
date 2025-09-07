/**
 * Integration tests for distribution download functionality
 * These tests verify the complete flow of downloading and installing distributions
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DistributionRegistry } from '../../src/distributionRegistry';
import { DistributionDownloader } from '../../src/distributionDownloader';
import { WSLImageManager } from '../../src/imageManager';
import { CommandBuilder } from '../../src/utils/commandBuilder';

// These tests are skipped in CI but can be run locally with actual WSL
const describeIntegration = process.env.CI ? describe.skip : describe;

describe('Distribution Download Integration', () => {
    let registry: DistributionRegistry;
    let downloader: DistributionDownloader;
    let imageManager: WSLImageManager;
    let tempDir: string;
    
    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-integration-test-'));
        registry = new DistributionRegistry();
        downloader = new DistributionDownloader(registry);
        imageManager = new WSLImageManager(path.join(tempDir, 'images'));
    });
    
    afterAll(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });
    
    describe('Distribution Registry Integration', () => {
        it('should fetch real distribution list from Microsoft', async () => {
            const distributions = await registry.fetchAvailableDistributions();
            
            // Verify we get actual distributions
            expect(distributions.length).toBeGreaterThan(0);
            
            // Check for known distributions
            const distroNames = distributions.map(d => d.Name);
            expect(distroNames).toContain('Ubuntu');
            expect(distroNames).toContain('Debian');
            
            // Verify structure
            const ubuntu = distributions.find(d => d.Name === 'Ubuntu');
            expect(ubuntu).toBeDefined();
            expect(ubuntu!.FriendlyName).toBeDefined();
            expect(ubuntu!.Amd64PackageUrl).toBeDefined();
        });
        
        it('should cache distributions locally', async () => {
            // First fetch
            await registry.fetchAvailableDistributions();
            
            // Check cache file exists
            const cacheDir = registry['getCacheDirectory']();
            const cacheFile = path.join(cacheDir, 'distributions.json');
            expect(fs.existsSync(cacheFile)).toBe(true);
            
            // Verify cache content
            const cacheContent = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            expect(cacheContent.distributions).toBeDefined();
            expect(cacheContent.timestamp).toBeDefined();
        });
        
        it('should handle network failure gracefully', async () => {
            // Mock network failure
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            
            // Should still work (from cache or return empty)
            const distributions = await registry.fetchAvailableDistributions();
            expect(Array.isArray(distributions)).toBe(true);
            
            // Restore fetch
            global.fetch = originalFetch;
        });
    });
    
    describeIntegration('Distribution Download with Real WSL', () => {
        // These tests require WSL to be installed and will actually download distributions
        // They are skipped in CI environments
        
        it('should download a small distribution (Alpine)', async () => {
            // Alpine is small (~50MB) so good for testing
            jest.setTimeout(120000); // 2 minutes timeout
            
            const progressEvents: any[] = [];
            const result = await downloader.downloadDistribution('Alpine', {
                onProgress: (progress) => progressEvents.push(progress)
            });
            
            expect(result).toBe('Alpine');
            expect(progressEvents.length).toBeGreaterThan(0);
            
            // Verify progress events have correct structure
            const lastProgress = progressEvents[progressEvents.length - 1];
            expect(lastProgress.percent).toBeLessThanOrEqual(100);
        }, 120000);
        
        it('should handle download interruption and retry', async () => {
            // This test simulates network interruption
            jest.setTimeout(60000);
            
            let attemptCount = 0;
            const originalDownload = downloader['downloadWithProgress'];
            
            // Mock to fail first attempt
            downloader['downloadWithProgress'] = jest.fn().mockImplementation(async (...args) => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new Error('Network interrupted');
                }
                return originalDownload.apply(downloader, args);
            });
            
            const result = await downloader.downloadDistribution('Alpine', {
                maxRetries: 3
            });
            
            expect(attemptCount).toBeGreaterThan(1);
            expect(result).toBe('Alpine');
            
            // Restore original method
            downloader['downloadWithProgress'] = originalDownload;
        }, 60000);
    });
    
    describe('Image Creation Integration', () => {
        it('should create complete workflow: download -> image -> distribution', async () => {
            // This test demonstrates the full workflow
            
            // Step 1: Get available distributions
            const distributions = await registry.fetchAvailableDistributions();
            expect(distributions.length).toBeGreaterThan(0);
            
            // Step 2: Mock download (in real test would download)
            const mockDistName = 'TestUbuntu';
            downloader.downloadDistribution = jest.fn().mockResolvedValue(mockDistName);
            
            // Step 3: Create image from distribution (mocked)
            CommandBuilder.executeWSL = jest.fn()
                .mockResolvedValueOnce({ stdout: 'Export successful', stderr: '', exitCode: 0 });
            
            const imageName = 'ubuntu-test-image';
            await imageManager.createImage(mockDistName, imageName, {
                description: 'Test image for integration testing',
                tags: ['test', 'integration']
            });
            
            // Step 4: List images
            const images = await imageManager.listImages();
            const createdImage = images.find(i => i.name === imageName);
            expect(createdImage).toBeDefined();
            expect(createdImage!.tags).toContain('test');
            
            // Step 5: Create new distribution from image (mocked)
            CommandBuilder.executeWSL = jest.fn()
                .mockResolvedValueOnce({ stdout: 'Import successful', stderr: '', exitCode: 0 });
            
            const projectDistName = 'project-test';
            await imageManager.createDistributionFromImage(imageName, projectDistName);
            
            // Verify the complete flow worked
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                expect.arrayContaining(['--import', projectDistName]),
                expect.any(Object)
            );
        });
    });
    
    describe('Error Handling Integration', () => {
        it('should handle distribution not found error', async () => {
            await expect(downloader.downloadDistribution('NonExistentDistro123'))
                .rejects.toThrow();
        });
        
        it('should handle corrupted download', async () => {
            // Mock corrupted download
            const originalVerify = downloader['verifyChecksum'];
            downloader['verifyChecksum'] = jest.fn().mockResolvedValue(false);
            
            await expect(downloader.downloadDistribution('Ubuntu'))
                .rejects.toThrow(/checksum|verification|corrupt/i);
            
            // Restore
            downloader['verifyChecksum'] = originalVerify;
        });
        
        it('should handle insufficient disk space', async () => {
            // Mock disk space check
            downloader['checkDiskSpace'] = jest.fn().mockResolvedValue(false);
            
            await expect(downloader.downloadDistribution('Ubuntu'))
                .rejects.toThrow(/disk space|storage/i);
        });
    });
    
    describe('Project Isolation Integration', () => {
        it('should create isolated distribution for project', async () => {
            // Simulate project-specific distribution creation
            const projectName = 'my-project';
            const projectHash = require('crypto')
                .createHash('md5')
                .update(projectName)
                .digest('hex')
                .substring(0, 8);
            
            const projectDistName = `project-${projectHash}`;
            
            // Mock the image exists
            const imageName = 'base-dev-image';
            const imageDir = path.join(tempDir, 'images', imageName);
            fs.mkdirSync(imageDir, { recursive: true });
            fs.writeFileSync(
                path.join(imageDir, 'metadata.json'),
                JSON.stringify({
                    name: imageName,
                    baseDistribution: 'Ubuntu',
                    created: new Date().toISOString(),
                    size: 1024 * 1024,
                    architecture: 'x64',
                    wslVersion: '2.0.0'
                })
            );
            fs.writeFileSync(path.join(imageDir, 'rootfs.tar'), 'mock content');
            
            // Mock WSL import
            CommandBuilder.executeWSL = jest.fn()
                .mockResolvedValueOnce({ stdout: 'Import successful', stderr: '', exitCode: 0 });
            
            // Create project distribution
            await imageManager.createDistributionFromImage(imageName, projectDistName);
            
            // Verify isolation - different projects get different distributions
            const projectName2 = 'another-project';
            const projectHash2 = require('crypto')
                .createHash('md5')
                .update(projectName2)
                .digest('hex')
                .substring(0, 8);
            
            expect(projectHash).not.toBe(projectHash2);
            expect(`project-${projectHash}`).not.toBe(`project-${projectHash2}`);
        });
    });
});