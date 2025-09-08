/**
 * Tests for DistroManager
 */

import { DistroManager } from '../../src/distros/DistroManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module
jest.mock('fs');

describe('DistroManager', () => {
    let distroManager: DistroManager;
    let mockFs: jest.Mocked<typeof fs>;
    let tempDir: string;
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockFs = fs as jest.Mocked<typeof fs>;
        
        tempDir = path.join(os.tmpdir(), 'test-distros');
        distroManager = new DistroManager(tempDir);
        
        // Mock filesystem operations
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => undefined);
        mockFs.readFileSync.mockImplementation(() => '{}');
        mockFs.writeFileSync.mockImplementation(() => undefined);
    });
    
    describe('initialization', () => {
        it('should create storage directory if it does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            
            new DistroManager(tempDir);
            
            expect(mockFs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('distros'),
                { recursive: true }
            );
        });
        
        it('should load existing catalog if present', () => {
            const mockCatalog = {
                version: '1.0.0',
                updated: '2024-01-01',
                distributions: []
            };
            
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCatalog));
            
            new DistroManager(tempDir);
            
            expect(mockFs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('catalog.json'),
                'utf8'
            );
        });
        
        it('should create default catalog if none exists', () => {
            mockFs.existsSync.mockImplementation((path) => {
                return !path.toString().includes('catalog.json');
            });
            
            new DistroManager(tempDir);
            
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('catalog.json'),
                expect.stringContaining('ubuntu-22.04'),
                'utf8'
            );
        });
    });
    
    describe('listDistros', () => {
        it('should return list of available distros', async () => {
            const mockCatalog = {
                version: '1.0.0',
                updated: '2024-01-01',
                distributions: [
                    {
                        name: 'ubuntu-22.04',
                        displayName: 'Ubuntu 22.04 LTS',
                        description: 'Ubuntu Jammy',
                        version: '22.04.3',
                        architecture: 'x64',
                        size: 650 * 1024 * 1024
                    }
                ]
            };
            
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(mockCatalog));
            
            const distros = await distroManager.listDistros();
            
            expect(distros).toHaveLength(1);
            expect(distros[0].name).toBe('ubuntu-22.04');
            expect(distros[0].available).toBeDefined();
        });
        
        it('should mark distros as available when tar file exists', async () => {
            mockFs.existsSync.mockImplementation((path) => {
                return path.toString().includes('ubuntu-22.04.tar');
            });
            
            const distros = await distroManager.listDistros();
            const ubuntu = distros.find(d => d.name === 'ubuntu-22.04');
            
            expect(ubuntu?.available).toBe(true);
        });
    });
    
    describe('getDistro', () => {
        it('should return specific distro by name', async () => {
            const distro = await distroManager.getDistro('ubuntu-22.04');
            
            expect(distro).toBeDefined();
            expect(distro?.name).toBe('ubuntu-22.04');
        });
        
        it('should return null for non-existent distro', async () => {
            const distro = await distroManager.getDistro('non-existent');
            
            expect(distro).toBeNull();
        });
    });
    
    describe('addDistro', () => {
        it('should add new distro to catalog', async () => {
            const newDistro = {
                name: 'custom-distro',
                displayName: 'Custom Distro',
                description: 'A custom distribution',
                version: '1.0.0',
                architecture: 'x64' as const
            };
            
            const tarPath = '/tmp/custom.tar';
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ size: 1024 } as any);
            mockFs.createReadStream.mockReturnValue({
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(Buffer.from('test'));
                    } else if (event === 'end') {
                        callback();
                    }
                    return { on: jest.fn() };
                })
            } as any);
            mockFs.copyFileSync.mockImplementation(() => undefined);
            
            await distroManager.addDistro(newDistro, tarPath);
            
            expect(mockFs.copyFileSync).toHaveBeenCalled();
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('catalog.json'),
                expect.stringContaining('custom-distro'),
                'utf8'
            );
        });
        
        it('should calculate SHA256 hash for added distro', async () => {
            const newDistro = {
                name: 'test-distro',
                displayName: 'Test',
                description: 'Test',
                version: '1.0',
                architecture: 'x64' as const
            };
            
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ size: 100 } as any);
            mockFs.createReadStream.mockReturnValue({
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(Buffer.from('test-content'));
                    } else if (event === 'end') {
                        callback();
                    }
                    return { on: jest.fn() };
                })
            } as any);
            
            await distroManager.addDistro(newDistro, '/tmp/test.tar');
            
            const savedCatalog = mockFs.writeFileSync.mock.calls[0][1] as string;
            expect(savedCatalog).toContain('sha256');
        });
    });
    
    describe('removeDistro', () => {
        it('should remove distro file and update catalog', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.unlinkSync.mockImplementation(() => undefined);
            
            await distroManager.removeDistro('ubuntu-22.04');
            
            expect(mockFs.unlinkSync).toHaveBeenCalledWith(
                expect.stringContaining('ubuntu-22.04.tar')
            );
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });
    });
    
    describe('verifyDistro', () => {
        it('should verify distro integrity with SHA256', async () => {
            const mockDistro = {
                name: 'test',
                sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' // SHA256 of "test"
            };
            
            mockFs.existsSync.mockImplementation(() => true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                version: '1.0.0',
                distributions: [mockDistro]
            }));
            mockFs.createReadStream.mockReturnValue({
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(Buffer.from('test'));
                    } else if (event === 'end') {
                        callback();
                    }
                    return { on: jest.fn() };
                })
            } as any);
            
            const isValid = await distroManager.verifyDistro('test');
            
            expect(isValid).toBe(true);
        });
        
        it('should return false for invalid hash', async () => {
            const mockDistro = {
                name: 'test',
                sha256: 'invalid-hash'
            };
            
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                version: '1.0.0',
                distributions: [mockDistro]
            }));
            mockFs.createReadStream.mockReturnValue({
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(Buffer.from('test'));
                    } else if (event === 'end') {
                        callback();
                    }
                    return { on: jest.fn() };
                })
            } as any);
            
            const isValid = await distroManager.verifyDistro('test');
            
            expect(isValid).toBe(false);
        });
    });
    
    describe('importDistro', () => {
        it('should import external tar file as new distro', async () => {
            const tarPath = '/external/distro.tar';
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ size: 5000 } as any);
            mockFs.createReadStream.mockReturnValue({
                on: jest.fn((event, callback) => {
                    if (event === 'end') callback();
                    return { on: jest.fn() };
                })
            } as any);
            
            await distroManager.importDistro(
                tarPath,
                'imported-distro',
                'Imported Distro',
                'Custom imported distribution'
            );
            
            expect(mockFs.copyFileSync).toHaveBeenCalled();
            const savedCatalog = mockFs.writeFileSync.mock.calls[0][1] as string;
            expect(savedCatalog).toContain('imported-distro');
            expect(savedCatalog).toContain('custom');
            expect(savedCatalog).toContain('imported');
        });
    });
    
    describe('getStorageStats', () => {
        it('should calculate storage statistics', async () => {
            mockFs.existsSync.mockImplementation((path) => {
                return path.toString().includes('ubuntu-22.04.tar');
            });
            mockFs.statSync.mockReturnValue({ size: 650 * 1024 * 1024 } as any);
            
            const stats = await distroManager.getStorageStats();
            
            expect(stats.totalDistros).toBeGreaterThan(0);
            expect(stats.availableDistros).toBeGreaterThan(0);
            expect(stats.storageUsed).toBeGreaterThan(0);
            expect(stats.totalSize).toBeGreaterThan(0);
        });
    });
});