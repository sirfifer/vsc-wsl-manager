/**
 * Unit tests for WSLImageManager
 * Tests image creation, storage, and distribution management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WSLImageManager, ImageMetadata, ImageInfo } from '../../src/imageManager';
import { CommandBuilder } from '../../src/utils/commandBuilder';

// Mock dependencies
jest.mock('../../src/utils/commandBuilder');
jest.mock('fs/promises');

describe('WSLImageManager', () => {
    let imageManager: WSLImageManager;
    let tempDir: string;
    let mockImageStore: string;
    
    beforeEach(() => {
        // Create temp directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-images-test-'));
        mockImageStore = path.join(tempDir, 'images');
        
        // Create image manager with test directory
        imageManager = new WSLImageManager(mockImageStore);
        
        // Create mock image store directory
        fs.mkdirSync(mockImageStore, { recursive: true });
        
        // Reset mocks
        jest.clearAllMocks();
    });
    
    afterEach(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });
    
    describe('createImage', () => {
        it('should export distribution to TAR and save metadata', async () => {
            const sourceDist = 'Ubuntu';
            const imageName = 'ubuntu-base';
            
            // Mock wsl --export command
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Export successful',
                stderr: '',
                exitCode: 0
            });
            
            // Mock file system operations
            const mockStat = { size: 1024 * 1024 * 500 }; // 500MB
            fs.promises.stat = jest.fn().mockResolvedValue(mockStat);
            fs.promises.writeFile = jest.fn().mockResolvedValue(undefined);
            
            // Mock WSL version check
            imageManager['getWslVersion'] = jest.fn().mockResolvedValue('2.0.0');
            
            await imageManager.createImage(sourceDist, imageName);
            
            // Verify wsl --export was called
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                ['--export', sourceDist, expect.stringContaining('rootfs.tar')],
                expect.any(Object)
            );
            
            // Verify metadata was saved
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('metadata.json'),
                expect.stringContaining('"name":"ubuntu-base"'),
                'utf8'
            );
        });
        
        it('should include custom metadata when provided', async () => {
            const sourceDist = 'Ubuntu';
            const imageName = 'ubuntu-dev';
            const customMetadata: Partial<ImageMetadata> = {
                description: 'Development environment',
                tags: ['dev', 'nodejs'],
                author: 'test-user'
            };
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Export successful',
                stderr: '',
                exitCode: 0
            });
            
            fs.promises.stat = jest.fn().mockResolvedValue({ size: 1024 * 1024 });
            fs.promises.writeFile = jest.fn().mockResolvedValue(undefined);
            imageManager['getWslVersion'] = jest.fn().mockResolvedValue('2.0.0');
            
            await imageManager.createImage(sourceDist, imageName, customMetadata);
            
            // Verify custom metadata was included
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('metadata.json'),
                expect.stringContaining('"description":"Development environment"'),
                'utf8'
            );
        });
        
        it('should compress image when requested', async () => {
            const sourceDist = 'Alpine';
            const imageName = 'alpine-minimal';
            const metadata = { compress: true };
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Export successful',
                stderr: '',
                exitCode: 0
            });
            
            fs.promises.stat = jest.fn().mockResolvedValue({ size: 1024 * 1024 });
            fs.promises.writeFile = jest.fn().mockResolvedValue(undefined);
            imageManager['getWslVersion'] = jest.fn().mockResolvedValue('2.0.0');
            
            // Mock compression
            imageManager['compressImage'] = jest.fn().mockResolvedValue(undefined);
            
            await imageManager.createImage(sourceDist, imageName, metadata);
            
            expect(imageManager['compressImage']).toHaveBeenCalledWith(
                expect.stringContaining('rootfs.tar')
            );
        });
        
        it('should handle export failure gracefully', async () => {
            const sourceDist = 'NonExistent';
            const imageName = 'test-image';
            
            (CommandBuilder.executeWSL as jest.Mock).mockRejectedValueOnce(
                new Error('Distribution not found')
            );
            
            await expect(imageManager.createImage(sourceDist, imageName))
                .rejects.toThrow('Distribution not found');
        });
    });
    
    describe('createDistributionFromImage', () => {
        beforeEach(() => {
            // Create a mock image directory with metadata
            const imageDir = path.join(mockImageStore, 'ubuntu-base');
            fs.mkdirSync(imageDir, { recursive: true });
            
            const metadata: ImageMetadata = {
                name: 'ubuntu-base',
                baseDistribution: 'Ubuntu',
                created: new Date().toISOString(),
                size: 1024 * 1024 * 500,
                architecture: 'x64',
                wslVersion: '2.0.0'
            };
            
            fs.writeFileSync(
                path.join(imageDir, 'metadata.json'),
                JSON.stringify(metadata)
            );
            
            // Create mock TAR file
            fs.writeFileSync(path.join(imageDir, 'rootfs.tar'), 'mock tar content');
        });
        
        it('should import TAR as new distribution', async () => {
            const imageName = 'ubuntu-base';
            const distName = 'project-dev';
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Import successful',
                stderr: '',
                exitCode: 0
            });
            
            await imageManager.createDistributionFromImage(imageName, distName);
            
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                expect.arrayContaining(['--import', distName]),
                expect.any(Object)
            );
        });
        
        it('should decompress compressed images before import', async () => {
            const imageName = 'ubuntu-base';
            const distName = 'project-dev';
            
            // Create compressed tar.gz
            const imageDir = path.join(mockImageStore, imageName);
            fs.unlinkSync(path.join(imageDir, 'rootfs.tar'));
            fs.writeFileSync(path.join(imageDir, 'rootfs.tar.gz'), 'compressed content');
            
            // Mock decompression
            imageManager['decompressImage'] = jest.fn().mockResolvedValue(undefined);
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Import successful',
                stderr: '',
                exitCode: 0
            });
            
            await imageManager.createDistributionFromImage(imageName, distName);
            
            expect(imageManager['decompressImage']).toHaveBeenCalled();
        });
        
        it('should apply post-install scripts when specified', async () => {
            const imageName = 'ubuntu-base';
            const distName = 'project-dev';
            
            // Update metadata with post-install script
            const imageDir = path.join(mockImageStore, imageName);
            const metadata: ImageMetadata = {
                name: imageName,
                baseDistribution: 'Ubuntu',
                created: new Date().toISOString(),
                size: 1024 * 1024,
                architecture: 'x64',
                wslVersion: '2.0.0',
                postInstallScript: 'apt-get update && apt-get install -y nodejs'
            };
            
            fs.writeFileSync(
                path.join(imageDir, 'metadata.json'),
                JSON.stringify(metadata)
            );
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Import successful',
                stderr: '',
                exitCode: 0
            });
            
            // Mock post-install script execution
            imageManager['runPostInstallScript'] = jest.fn().mockResolvedValue(undefined);
            
            await imageManager.createDistributionFromImage(imageName, distName);
            
            expect(imageManager['runPostInstallScript']).toHaveBeenCalledWith(
                distName,
                'apt-get update && apt-get install -y nodejs'
            );
        });
        
        it('should use custom install path when provided', async () => {
            const imageName = 'ubuntu-base';
            const distName = 'project-dev';
            const installPath = 'D:\\WSL\\custom-location';
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Import successful',
                stderr: '',
                exitCode: 0
            });
            
            await imageManager.createDistributionFromImage(imageName, distName, installPath);
            
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                expect.arrayContaining(['--import', distName, installPath]),
                expect.any(Object)
            );
        });
        
        it('should throw error if image does not exist', async () => {
            const imageName = 'non-existent';
            const distName = 'test';
            
            await expect(imageManager.createDistributionFromImage(imageName, distName))
                .rejects.toThrow('Image not found: non-existent');
        });
    });
    
    describe('listImages', () => {
        beforeEach(() => {
            // Create multiple mock images
            const images = [
                {
                    name: 'ubuntu-base',
                    baseDistribution: 'Ubuntu',
                    size: 500 * 1024 * 1024,
                    created: '2024-01-01T00:00:00Z'
                },
                {
                    name: 'alpine-minimal',
                    baseDistribution: 'Alpine',
                    size: 50 * 1024 * 1024,
                    created: '2024-01-02T00:00:00Z'
                },
                {
                    name: 'debian-dev',
                    baseDistribution: 'Debian',
                    size: 750 * 1024 * 1024,
                    created: '2024-01-03T00:00:00Z',
                    tags: ['development', 'nodejs']
                }
            ];
            
            images.forEach(img => {
                const imageDir = path.join(mockImageStore, img.name);
                fs.mkdirSync(imageDir, { recursive: true });
                
                const metadata: ImageMetadata = {
                    ...img,
                    architecture: 'x64',
                    wslVersion: '2.0.0'
                } as ImageMetadata;
                
                fs.writeFileSync(
                    path.join(imageDir, 'metadata.json'),
                    JSON.stringify(metadata)
                );
                
                // Create mock TAR file with size
                const tarContent = Buffer.alloc(img.size);
                fs.writeFileSync(path.join(imageDir, 'rootfs.tar'), tarContent);
            });
        });
        
        it('should return all images with metadata', async () => {
            const images = await imageManager.listImages();
            
            expect(images).toHaveLength(3);
            expect(images.map(i => i.name)).toEqual(['ubuntu-base', 'alpine-minimal', 'debian-dev']);
        });
        
        it('should include size information', async () => {
            const images = await imageManager.listImages();
            
            const ubuntuImage = images.find(i => i.name === 'ubuntu-base');
            expect(ubuntuImage?.size).toBe(500 * 1024 * 1024);
            
            const alpineImage = images.find(i => i.name === 'alpine-minimal');
            expect(alpineImage?.size).toBe(50 * 1024 * 1024);
        });
        
        it('should include creation date', async () => {
            const images = await imageManager.listImages();
            
            const debianImage = images.find(i => i.name === 'debian-dev');
            expect(debianImage?.created).toBe('2024-01-03T00:00:00Z');
        });
        
        it('should include tags when present', async () => {
            const images = await imageManager.listImages();
            
            const debianImage = images.find(i => i.name === 'debian-dev');
            expect(debianImage?.tags).toEqual(['development', 'nodejs']);
        });
        
        it('should return empty array when no images exist', async () => {
            // Remove all images
            fs.rmSync(mockImageStore, { recursive: true });
            fs.mkdirSync(mockImageStore);
            
            const images = await imageManager.listImages();
            
            expect(images).toEqual([]);
        });
    });
    
    describe('deleteImage', () => {
        beforeEach(() => {
            // Create a mock image
            const imageDir = path.join(mockImageStore, 'test-image');
            fs.mkdirSync(imageDir, { recursive: true });
            fs.writeFileSync(path.join(imageDir, 'metadata.json'), '{}');
            fs.writeFileSync(path.join(imageDir, 'rootfs.tar'), 'content');
        });
        
        it('should delete image directory completely', async () => {
            const imageName = 'test-image';
            
            await imageManager.deleteImage(imageName);
            
            const imageDir = path.join(mockImageStore, imageName);
            expect(fs.existsSync(imageDir)).toBe(false);
        });
        
        it('should throw error if image does not exist', async () => {
            await expect(imageManager.deleteImage('non-existent'))
                .rejects.toThrow('Image not found: non-existent');
        });
    });
    
    describe('getImageInfo', () => {
        beforeEach(() => {
            const imageDir = path.join(mockImageStore, 'ubuntu-base');
            fs.mkdirSync(imageDir, { recursive: true });
            
            const metadata: ImageMetadata = {
                name: 'ubuntu-base',
                baseDistribution: 'Ubuntu',
                created: '2024-01-01T00:00:00Z',
                size: 500 * 1024 * 1024,
                architecture: 'x64',
                wslVersion: '2.0.0',
                description: 'Base Ubuntu image'
            };
            
            fs.writeFileSync(
                path.join(imageDir, 'metadata.json'),
                JSON.stringify(metadata)
            );
        });
        
        it('should return detailed image information', async () => {
            const info = await imageManager.getImageInfo('ubuntu-base');
            
            expect(info).toBeDefined();
            expect(info.name).toBe('ubuntu-base');
            expect(info.baseDistribution).toBe('Ubuntu');
            expect(info.description).toBe('Base Ubuntu image');
            expect(info.size).toBe(500 * 1024 * 1024);
        });
        
        it('should throw error for non-existent image', async () => {
            await expect(imageManager.getImageInfo('non-existent'))
                .rejects.toThrow('Image not found: non-existent');
        });
    });
    
    describe('image compression', () => {
        it('should compress TAR file to TAR.GZ', async () => {
            const tarPath = path.join(mockImageStore, 'test.tar');
            fs.writeFileSync(tarPath, 'uncompressed content');
            
            // Mock compression using zlib
            const zlib = require('zlib');
            zlib.createGzip = jest.fn().mockReturnValue({
                pipe: jest.fn(),
                on: jest.fn((event, callback) => {
                    if (event === 'finish') callback();
                })
            });
            
            await imageManager['compressImage'](tarPath);
            
            expect(zlib.createGzip).toHaveBeenCalled();
        });
        
        it('should detect compressed images', async () => {
            const compressedPath = path.join(mockImageStore, 'test.tar.gz');
            const uncompressedPath = path.join(mockImageStore, 'test.tar');
            
            fs.writeFileSync(compressedPath, 'compressed');
            fs.writeFileSync(uncompressedPath, 'uncompressed');
            
            expect(await imageManager['isCompressed'](compressedPath)).toBe(true);
            expect(await imageManager['isCompressed'](uncompressedPath)).toBe(false);
        });
    });
});