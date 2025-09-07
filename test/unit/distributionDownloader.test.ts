/**
 * Unit tests for DistributionDownloader
 * Tests robust distribution download with multiple fallback methods
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { DistributionDownloader, DownloadOptions, DownloadProgress } from '../../src/distributionDownloader';
import { DistributionRegistry } from '../../src/distributionRegistry';
import { CommandBuilder } from '../../src/utils/commandBuilder';

// Mock dependencies
jest.mock('../../src/distributionRegistry');
jest.mock('../../src/utils/commandBuilder');
jest.mock('fs');
jest.mock('https');

// Mock fetch for download tests
global.fetch = jest.fn();

describe('DistributionDownloader', () => {
    let downloader: DistributionDownloader;
    let mockRegistry: jest.Mocked<DistributionRegistry>;
    let tempDir: string;
    
    beforeEach(() => {
        // Create mock registry
        mockRegistry = new DistributionRegistry() as jest.Mocked<DistributionRegistry>;
        downloader = new DistributionDownloader(mockRegistry);
        
        // Create temp directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-download-test-'));
        
        // Reset all mocks
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockReset();
    });
    
    afterEach(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });
    
    describe('downloadDistribution', () => {
        it('should try wsl --install first when running as admin', async () => {
            // Mock admin check
            downloader['hasAdminPrivileges'] = jest.fn().mockResolvedValue(true);
            
            // Mock successful wsl --install
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Ubuntu installed successfully',
                stderr: '',
                exitCode: 0
            });
            
            const result = await downloader.downloadDistribution('Ubuntu');
            
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                ['--install', '-d', 'Ubuntu'],
                expect.objectContaining({ timeout: expect.any(Number) })
            );
            expect(result).toBe('Ubuntu');
        });
        
        it('should fall back to URL download when not admin', async () => {
            // Mock not admin
            downloader['hasAdminPrivileges'] = jest.fn().mockResolvedValue(false);
            
            // Mock registry returning distribution info
            mockRegistry.getDistributionInfo = jest.fn().mockReturnValue({
                Name: 'Ubuntu',
                FriendlyName: 'Ubuntu',
                Amd64PackageUrl: 'https://aka.ms/wslubuntu',
                StoreAppId: '9PN20MSR04DW'
            });
            
            // Mock successful download
            downloader['downloadFromUrl'] = jest.fn().mockResolvedValue('Ubuntu');
            
            const result = await downloader.downloadDistribution('Ubuntu');
            
            expect(mockRegistry.getDistributionInfo).toHaveBeenCalledWith('Ubuntu');
            expect(downloader['downloadFromUrl']).toHaveBeenCalled();
            expect(result).toBe('Ubuntu');
        });
        
        it('should fall back to rootfs download when URL fails', async () => {
            // Mock not admin
            downloader['hasAdminPrivileges'] = jest.fn().mockResolvedValue(false);
            
            // Mock registry returning null (distribution not found)
            mockRegistry.getDistributionInfo = jest.fn().mockReturnValue(null);
            
            // Mock rootfs download
            downloader['downloadRootfs'] = jest.fn().mockResolvedValue('Ubuntu');
            
            const result = await downloader.downloadDistribution('Ubuntu');
            
            expect(downloader['downloadRootfs']).toHaveBeenCalledWith('Ubuntu');
            expect(result).toBe('Ubuntu');
        });
        
        it('should handle download progress events', async () => {
            const progressCallback = jest.fn();
            const options: DownloadOptions = {
                onProgress: progressCallback
            };
            
            // Mock not admin
            downloader['hasAdminPrivileges'] = jest.fn().mockResolvedValue(false);
            
            // Mock registry
            mockRegistry.getDistributionInfo = jest.fn().mockReturnValue({
                Name: 'Ubuntu',
                Amd64PackageUrl: 'https://aka.ms/wslubuntu'
            });
            
            // Mock download with progress
            downloader['downloadWithProgress'] = jest.fn().mockImplementation(
                async (url: string, dest: string, onProgress?: (progress: DownloadProgress) => void) => {
                    // Simulate progress events
                    if (onProgress) {
                        onProgress({ percent: 0, downloaded: 0, total: 1000 });
                        onProgress({ percent: 50, downloaded: 500, total: 1000 });
                        onProgress({ percent: 100, downloaded: 1000, total: 1000 });
                    }
                    return dest;
                }
            );
            
            downloader['importPackage'] = jest.fn().mockResolvedValue(undefined);
            
            await downloader.downloadDistribution('Ubuntu', options);
            
            expect(progressCallback).toHaveBeenCalledTimes(3);
            expect(progressCallback).toHaveBeenCalledWith({ percent: 50, downloaded: 500, total: 1000 });
        });
        
        it('should retry on network failure', async () => {
            // Mock not admin
            downloader['hasAdminPrivileges'] = jest.fn().mockResolvedValue(false);
            
            // Mock registry
            mockRegistry.getDistributionInfo = jest.fn().mockReturnValue({
                Name: 'Ubuntu',
                Amd64PackageUrl: 'https://aka.ms/wslubuntu'
            });
            
            // Mock download with retry
            let attempts = 0;
            downloader['downloadWithProgress'] = jest.fn().mockImplementation(async () => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('Network error');
                }
                return tempDir + '/ubuntu.wsl';
            });
            
            downloader['importPackage'] = jest.fn().mockResolvedValue(undefined);
            
            const result = await downloader.downloadDistribution('Ubuntu', { maxRetries: 3 });
            
            expect(attempts).toBe(3);
            expect(result).toBe('Ubuntu');
        });
        
        it('should verify downloaded file integrity when checksum available', async () => {
            // Mock not admin
            downloader['hasAdminPrivileges'] = jest.fn().mockResolvedValue(false);
            
            // Mock registry with checksum
            mockRegistry.getDistributionInfo = jest.fn().mockReturnValue({
                Name: 'Ubuntu',
                Amd64PackageUrl: 'https://aka.ms/wslubuntu',
                Checksum: 'abc123def456'
            });
            
            // Mock download and verification
            downloader['downloadWithProgress'] = jest.fn().mockResolvedValue(tempDir + '/ubuntu.wsl');
            downloader['verifyChecksum'] = jest.fn().mockResolvedValue(true);
            downloader['importPackage'] = jest.fn().mockResolvedValue(undefined);
            
            await downloader.downloadDistribution('Ubuntu');
            
            expect(downloader['verifyChecksum']).toHaveBeenCalledWith(
                tempDir + '/ubuntu.wsl',
                'abc123def456'
            );
        });
        
        it('should throw error when all download methods fail', async () => {
            // Mock not admin
            downloader['hasAdminPrivileges'] = jest.fn().mockResolvedValue(false);
            
            // Mock all methods failing
            mockRegistry.getDistributionInfo = jest.fn().mockReturnValue(null);
            downloader['downloadRootfs'] = jest.fn().mockRejectedValue(new Error('All sources failed'));
            
            await expect(downloader.downloadDistribution('Ubuntu')).rejects.toThrow('All sources failed');
        });
    });
    
    describe('downloadWithProgress', () => {
        it('should download file with progress tracking', async () => {
            const url = 'https://example.com/test.wsl';
            const dest = path.join(tempDir, 'test.wsl');
            const progressCallback = jest.fn();
            
            // Mock fetch response with readable stream
            const mockBody = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array([1, 2, 3]));
                    controller.enqueue(new Uint8Array([4, 5, 6]));
                    controller.close();
                }
            });
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                headers: {
                    get: (name: string) => name === 'content-length' ? '6' : null
                },
                body: mockBody
            });
            
            // Mock fs.createWriteStream
            const mockWriteStream = {
                write: jest.fn((chunk, callback) => callback()),
                end: jest.fn((callback) => callback()),
                on: jest.fn()
            };
            (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
            
            await downloader['downloadWithProgress'](url, dest, progressCallback);
            
            expect(global.fetch).toHaveBeenCalledWith(url);
            expect(progressCallback).toHaveBeenCalled();
        });
        
        it('should handle download without content-length header', async () => {
            const url = 'https://example.com/test.wsl';
            const dest = path.join(tempDir, 'test.wsl');
            
            // Mock fetch without content-length
            const mockBody = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array([1, 2, 3]));
                    controller.close();
                }
            });
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                headers: {
                    get: () => null
                },
                body: mockBody
            });
            
            const mockWriteStream = {
                write: jest.fn((chunk, callback) => callback()),
                end: jest.fn((callback) => callback()),
                on: jest.fn()
            };
            (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
            
            await downloader['downloadWithProgress'](url, dest);
            
            // Should complete without error even without content-length
            expect(global.fetch).toHaveBeenCalledWith(url);
        });
    });
    
    describe('importPackage', () => {
        it('should import .wsl package using wsl --import', async () => {
            const packagePath = path.join(tempDir, 'ubuntu.wsl');
            const distName = 'Ubuntu';
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Import successful',
                stderr: '',
                exitCode: 0
            });
            
            await downloader['importPackage'](packagePath, distName);
            
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                expect.arrayContaining(['--import', distName]),
                expect.any(Object)
            );
        });
        
        it('should handle .appx packages differently', async () => {
            const packagePath = path.join(tempDir, 'ubuntu.appx');
            const distName = 'Ubuntu';
            
            // Mock PowerShell execution for .appx
            downloader['installAppxPackage'] = jest.fn().mockResolvedValue(undefined);
            
            await downloader['importPackage'](packagePath, distName);
            
            expect(downloader['installAppxPackage']).toHaveBeenCalledWith(packagePath);
        });
    });
    
    describe('hasAdminPrivileges', () => {
        it('should detect admin privileges on Windows', async () => {
            // Mock process.platform
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            
            // Mock exec to simulate admin check
            const { exec } = require('child_process');
            exec.mockImplementation((cmd: string, callback: Function) => {
                callback(null, 'Administrator', '');
            });
            
            const isAdmin = await downloader['hasAdminPrivileges']();
            
            expect(isAdmin).toBe(true);
        });
        
        it('should return false when not admin', async () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            
            const { exec } = require('child_process');
            exec.mockImplementation((cmd: string, callback: Function) => {
                callback(new Error('Not admin'), '', 'Access denied');
            });
            
            const isAdmin = await downloader['hasAdminPrivileges']();
            
            expect(isAdmin).toBe(false);
        });
    });
    
    describe('downloadRootfs', () => {
        it('should download rootfs from alternative sources', async () => {
            const distName = 'alpine';
            
            // Mock rootfs URL mapping
            downloader['getRootfsUrl'] = jest.fn().mockReturnValue('https://dl-cdn.alpinelinux.org/alpine/latest.tar.gz');
            
            // Mock download
            downloader['downloadWithProgress'] = jest.fn().mockResolvedValue(tempDir + '/alpine.tar.gz');
            
            // Mock import
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Import successful',
                stderr: '',
                exitCode: 0
            });
            
            const result = await downloader['downloadRootfs'](distName);
            
            expect(downloader['getRootfsUrl']).toHaveBeenCalledWith(distName);
            expect(result).toBe(distName);
        });
    });
});