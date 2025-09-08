/**
 * Tests for WSLImageManager
 */

import { WSLImageManager } from '../../src/images/WSLImageManager';
import { ManifestManager } from '../../src/manifest/ManifestManager';
import { DistroManager } from '../../src/distros/DistroManager';
import { CommandBuilder } from '../../src/utils/commandBuilder';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('../../src/utils/commandBuilder');
jest.mock('../../src/manifest/ManifestManager');
jest.mock('../../src/distros/DistroManager');

describe('WSLImageManager', () => {
    let imageManager: WSLImageManager;
    let mockFs: jest.Mocked<typeof fs>;
    let mockManifestManager: jest.Mocked<ManifestManager>;
    let mockDistroManager: jest.Mocked<DistroManager>;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        mockFs = fs as jest.Mocked<typeof fs>;
        mockManifestManager = new ManifestManager() as jest.Mocked<ManifestManager>;
        mockDistroManager = new DistroManager() as jest.Mocked<DistroManager>;
        
        // Setup default mocks
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => undefined);
        mockFs.readFileSync.mockReturnValue('{}');
        mockFs.writeFileSync.mockImplementation(() => undefined);
        
        (CommandBuilder.executeWSL as jest.Mock).mockResolvedValue({
            stdout: '',
            stderr: '',
            exitCode: 0
        });
        
        imageManager = new WSLImageManager(mockManifestManager, mockDistroManager);
    });
    
    describe('createFromDistro', () => {
        it('should create image from pristine distro', async () => {
            const mockDistro = {
                name: 'ubuntu-22.04',
                displayName: 'Ubuntu 22.04',
                description: 'Ubuntu Jammy',
                version: '22.04.3',
                architecture: 'x64' as const,
                available: true,
                filePath: '/distros/ubuntu-22.04.tar',
                size: 650 * 1024 * 1024
            };
            
            mockDistroManager.getDistro.mockResolvedValue(mockDistro);
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'Alpine\nUbuntu\n',
                stderr: '',
                exitCode: 0
            });
            
            mockManifestManager.createDistroManifest.mockReturnValue({
                version: '1.0.0',
                metadata: {
                    id: 'test-id',
                    name: 'my-dev',
                    lineage: ['ubuntu-22.04'],
                    created: '2024-01-01',
                    created_by: 'test'
                },
                layers: []
            });
            
            await imageManager.createFromDistro('ubuntu-22.04', 'my-dev', {
                displayName: 'My Dev Environment',
                description: 'Development setup',
                enableTerminal: true
            });
            
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                expect.arrayContaining(['--import', 'my-dev']),
                expect.any(Object)
            );
            
            expect(mockManifestManager.writeManifest).toHaveBeenCalledWith(
                'my-dev',
                expect.any(Object)
            );
            
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('images.json'),
                expect.stringContaining('my-dev'),
                'utf8'
            );
        });
        
        it('should fail if distro not available', async () => {
            mockDistroManager.getDistro.mockResolvedValue({
                name: 'ubuntu-22.04',
                displayName: 'Ubuntu 22.04',
                description: 'Ubuntu Jammy',
                version: '22.04.3',
                architecture: 'x64' as const,
                available: false
            });
            
            await expect(
                imageManager.createFromDistro('ubuntu-22.04', 'my-dev')
            ).rejects.toThrow('not available locally');
        });
        
        it('should fail if image name already exists', async () => {
            mockDistroManager.getDistro.mockResolvedValue({
                name: 'ubuntu-22.04',
                displayName: 'Ubuntu 22.04',
                description: 'Test',
                version: '22.04',
                architecture: 'x64',
                available: true,
                filePath: '/test.tar'
            });
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'existing-image\n',
                stderr: '',
                exitCode: 0
            });
            
            await expect(
                imageManager.createFromDistro('ubuntu-22.04', 'existing-image')
            ).rejects.toThrow('already exists');
        });
        
        it('should clean up on failure', async () => {
            mockDistroManager.getDistro.mockResolvedValue({
                name: 'ubuntu-22.04',
                displayName: 'Ubuntu 22.04',
                description: 'Test',
                version: '22.04',
                architecture: 'x64',
                available: true,
                filePath: '/test.tar'
            });
            
            // First call for listing returns empty
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: '',
                stderr: '',
                exitCode: 0
            });
            
            // Import fails
            (CommandBuilder.executeWSL as jest.Mock).mockRejectedValueOnce(
                new Error('Import failed')
            );
            
            await expect(
                imageManager.createFromDistro('ubuntu-22.04', 'my-dev')
            ).rejects.toThrow('Import failed');
            
            // Verify cleanup was attempted
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                ['--unregister', 'my-dev']
            );
        });
    });
    
    describe('cloneImage', () => {
        beforeEach(() => {
            // Mock TEMP environment variable
            process.env.TEMP = '/tmp';
        });
        
        it('should clone existing image', async () => {
            // List distributions - source exists
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'source-image\n',
                stderr: '',
                exitCode: 0
            });
            
            // Export succeeds
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: '',
                stderr: '',
                exitCode: 0
            });
            
            // Import succeeds
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: '',
                stderr: '',
                exitCode: 0
            });
            
            const sourceManifest = {
                version: '1.0.0',
                metadata: {
                    id: 'source-id',
                    name: 'source-image',
                    lineage: ['ubuntu-22.04'],
                    created: '2024-01-01',
                    created_by: 'test'
                },
                layers: []
            };
            
            mockManifestManager.readManifest.mockResolvedValue(sourceManifest);
            mockManifestManager.createCloneManifest.mockReturnValue({
                ...sourceManifest,
                metadata: {
                    ...sourceManifest.metadata,
                    name: 'cloned-image',
                    parent: 'source-image',
                    lineage: ['ubuntu-22.04', 'source-image']
                }
            });
            
            await imageManager.cloneImage('source-image', 'cloned-image', {
                displayName: 'Cloned Image',
                description: 'A clone',
                enableTerminal: true
            });
            
            // Verify export was called
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                expect.arrayContaining(['--export', 'source-image']),
                expect.any(Object)
            );
            
            // Verify import was called
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                expect.arrayContaining(['--import', 'cloned-image']),
                expect.any(Object)
            );
            
            // Verify manifest was written
            expect(mockManifestManager.writeManifest).toHaveBeenCalledWith(
                'cloned-image',
                expect.any(Object)
            );
        });
        
        it('should fail if source does not exist', async () => {
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'other-image\n',
                stderr: '',
                exitCode: 0
            });
            
            await expect(
                imageManager.cloneImage('non-existent', 'new-image')
            ).rejects.toThrow('Source image not found');
        });
        
        it('should fail if target already exists', async () => {
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'source\ntarget\n',
                stderr: '',
                exitCode: 0
            });
            
            await expect(
                imageManager.cloneImage('source', 'target')
            ).rejects.toThrow('Target image already exists');
        });
        
        it('should clean up temp files on success', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.rmSync.mockImplementation(() => undefined);
            
            // Mock successful clone
            (CommandBuilder.executeWSL as jest.Mock)
                .mockResolvedValueOnce({ stdout: 'source\n', stderr: '', exitCode: 0 })
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
            
            mockManifestManager.readManifest.mockResolvedValue(null);
            
            await imageManager.cloneImage('source', 'target');
            
            // Verify temp directory was cleaned up
            expect(mockFs.rmSync).toHaveBeenCalledWith(
                expect.stringContaining('wsl-clone-'),
                { recursive: true }
            );
        });
    });
    
    describe('listImages', () => {
        it('should list all WSL distributions as images', async () => {
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'image1\nimage2\nimage3\n',
                stderr: '',
                exitCode: 0
            });
            
            mockManifestManager.hasManifest.mockResolvedValue(true);
            
            const images = await imageManager.listImages();
            
            expect(images).toHaveLength(3);
            expect(images[0].name).toBe('image1');
            expect(images[0].hasManifest).toBe(true);
        });
        
        it('should handle legacy distributions without metadata', async () => {
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'legacy-distro\n',
                stderr: '',
                exitCode: 0
            });
            
            mockManifestManager.hasManifest.mockResolvedValue(false);
            
            const images = await imageManager.listImages();
            
            expect(images).toHaveLength(1);
            expect(images[0].name).toBe('legacy-distro');
            expect(images[0].description).toBe('Legacy WSL distribution');
            expect(images[0].hasManifest).toBe(false);
        });
        
        it('should update metadata for existing images', async () => {
            // Pre-populate metadata
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                'existing-image': {
                    id: 'test-id',
                    name: 'existing-image',
                    displayName: 'Existing',
                    source: 'ubuntu',
                    sourceType: 'distro',
                    created: '2024-01-01',
                    wslVersion: 2,
                    hasManifest: false,
                    enabled: true
                }
            }));
            
            imageManager = new WSLImageManager(mockManifestManager, mockDistroManager);
            
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'existing-image\n',
                stderr: '',
                exitCode: 0
            });
            
            mockManifestManager.hasManifest.mockResolvedValue(true);
            
            const images = await imageManager.listImages();
            
            expect(images[0].hasManifest).toBe(true);
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('images.json'),
                expect.any(String),
                'utf8'
            );
        });
    });
    
    describe('deleteImage', () => {
        it('should unregister image from WSL', async () => {
            await imageManager.deleteImage('test-image');
            
            expect(CommandBuilder.executeWSL).toHaveBeenCalledWith(
                ['--unregister', 'test-image']
            );
        });
        
        it('should remove installation directory if exists', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                'test-image': {
                    id: 'test-id',
                    name: 'test-image',
                    installPath: '/path/to/install',
                    source: 'ubuntu',
                    sourceType: 'distro',
                    created: '2024-01-01',
                    wslVersion: 2,
                    hasManifest: true,
                    enabled: true
                }
            }));
            mockFs.rmSync.mockImplementation(() => undefined);
            
            imageManager = new WSLImageManager(mockManifestManager, mockDistroManager);
            
            await imageManager.deleteImage('test-image');
            
            expect(mockFs.rmSync).toHaveBeenCalledWith(
                '/path/to/install',
                { recursive: true }
            );
        });
        
        it('should update metadata after deletion', async () => {
            await imageManager.deleteImage('test-image');
            
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('images.json'),
                expect.not.stringContaining('test-image'),
                'utf8'
            );
        });
    });
    
    describe('updateImageProperties', () => {
        it('should update image metadata', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                'test-image': {
                    id: 'test-id',
                    name: 'test-image',
                    displayName: 'Old Name',
                    description: 'Old description',
                    enabled: false,
                    source: 'ubuntu',
                    sourceType: 'distro',
                    created: '2024-01-01',
                    wslVersion: 2,
                    hasManifest: true
                }
            }));
            
            imageManager = new WSLImageManager(mockManifestManager, mockDistroManager);
            
            await imageManager.updateImageProperties('test-image', {
                displayName: 'New Name',
                description: 'New description',
                enabled: true
            });
            
            const savedData = JSON.parse(
                mockFs.writeFileSync.mock.calls[0][1] as string
            );
            
            expect(savedData['test-image'].displayName).toBe('New Name');
            expect(savedData['test-image'].description).toBe('New description');
            expect(savedData['test-image'].enabled).toBe(true);
            
            // Critical fields should not change
            expect(savedData['test-image'].id).toBe('test-id');
            expect(savedData['test-image'].name).toBe('test-image');
            expect(savedData['test-image'].source).toBe('ubuntu');
        });
        
        it('should throw error if image not found', async () => {
            await expect(
                imageManager.updateImageProperties('non-existent', {})
            ).rejects.toThrow('Image not found');
        });
    });
    
    describe('getImageInfo', () => {
        it('should return image metadata', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                'test-image': {
                    id: 'test-id',
                    name: 'test-image',
                    displayName: 'Test Image',
                    source: 'ubuntu',
                    sourceType: 'distro',
                    created: '2024-01-01',
                    wslVersion: 2,
                    hasManifest: true,
                    enabled: true
                }
            }));
            
            imageManager = new WSLImageManager(mockManifestManager, mockDistroManager);
            
            // Mock list to ensure current
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: 'test-image\n',
                stderr: '',
                exitCode: 0
            });
            
            const info = await imageManager.getImageInfo('test-image');
            
            expect(info).toBeDefined();
            expect(info?.name).toBe('test-image');
            expect(info?.displayName).toBe('Test Image');
        });
        
        it('should return null for non-existent image', async () => {
            (CommandBuilder.executeWSL as jest.Mock).mockResolvedValueOnce({
                stdout: '',
                stderr: '',
                exitCode: 0
            });
            
            const info = await imageManager.getImageInfo('non-existent');
            
            expect(info).toBeNull();
        });
    });
});