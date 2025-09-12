/**
 * Tests for Distro Catalog and Availability
 * Ensures distro catalog is properly initialized and available
 */

import * as fs from 'fs';
import * as path from 'path';
import { DistroManager, DistroInfo, DistroCatalog } from '../../src/distros/DistroManager';

// Mock fs module
jest.mock('fs');

describe('Distro Catalog and Availability', () => {
    let distroManager: DistroManager;
    const mockFs = fs as jest.Mocked<typeof fs>;
    const testStorePath = '/test/.vscode-wsl-manager';
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock file system operations
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => undefined);
        mockFs.readFileSync.mockImplementation(() => '');
        mockFs.writeFileSync.mockImplementation(() => undefined);
    });
    
    describe('Catalog Initialization', () => {
        it('should create default catalog if none exists', () => {
            // Mock that catalog doesn't exist
            mockFs.existsSync.mockImplementation((path) => {
                if (path.toString().includes('catalog.json')) return false;
                return true;
            });
            
            distroManager = new DistroManager(testStorePath);
            
            // Should create directories and catalog
            expect(mockFs.mkdirSync).toHaveBeenCalled();
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('catalog.json'),
                expect.any(String)
            );
        });
        
        it('should include default distributions in new catalog', () => {
            let writtenCatalog: DistroCatalog | null = null;
            
            mockFs.writeFileSync.mockImplementation((path, data) => {
                if (path.toString().includes('catalog.json')) {
                    writtenCatalog = JSON.parse(data.toString());
                }
            });
            
            distroManager = new DistroManager(testStorePath);
            
            expect(writtenCatalog).not.toBeNull();
            expect(writtenCatalog!.distributions).toBeDefined();
            expect(writtenCatalog!.distributions.length).toBeGreaterThan(0);
            
            // Should have at least Ubuntu in default catalog
            const ubuntu = writtenCatalog!.distributions.find(d => 
                d.name.toLowerCase().includes('ubuntu')
            );
            expect(ubuntu).toBeDefined();
        });
        
        it('should load existing catalog if present', () => {
            const existingCatalog: DistroCatalog = {
                version: '1.0',
                updated: new Date().toISOString(),
                distributions: [
                    {
                        name: 'existing-distro',
                        displayName: 'Existing Distro',
                        description: 'Test distro',
                        version: '1.0',
                        architecture: 'x64',
                        available: true
                    }
                ]
            };
            
            mockFs.existsSync.mockImplementation((path) => {
                if (path.toString().includes('catalog.json')) return true;
                return false;
            });
            
            mockFs.readFileSync.mockImplementation((path) => {
                if (path.toString().includes('catalog.json')) {
                    return JSON.stringify(existingCatalog);
                }
                return '';
            });
            
            distroManager = new DistroManager(testStorePath);
            
            // Should not overwrite existing catalog
            expect(mockFs.writeFileSync).not.toHaveBeenCalledWith(
                expect.stringContaining('catalog.json'),
                expect.any(String)
            );
        });
    });
    
    describe('Distro Availability', () => {
        beforeEach(() => {
            const catalog: DistroCatalog = {
                version: '1.0',
                updated: new Date().toISOString(),
                distributions: [
                    {
                        name: 'ubuntu-24.04',
                        displayName: 'Ubuntu 24.04',
                        description: 'Ubuntu 24.04 LTS',
                        version: '24.04',
                        architecture: 'x64'
                    },
                    {
                        name: 'debian-12',
                        displayName: 'Debian 12',
                        description: 'Debian 12 Bookworm',
                        version: '12',
                        architecture: 'x64'
                    }
                ]
            };
            
            mockFs.existsSync.mockImplementation((path) => {
                const pathStr = path.toString();
                if (pathStr.includes('catalog.json')) return true;
                if (pathStr.includes('ubuntu-24.04.tar')) return true; // Ubuntu is downloaded
                if (pathStr.includes('debian-12.tar')) return false; // Debian is not
                return false;
            });
            
            mockFs.readFileSync.mockImplementation((path) => {
                if (path.toString().includes('catalog.json')) {
                    return JSON.stringify(catalog);
                }
                return '';
            });
        });
        
        it('should correctly identify available distros', async () => {
            distroManager = new DistroManager(testStorePath);
            const distros = await distroManager.listDistros();
            
            const ubuntu = distros.find(d => d.name === 'ubuntu-24.04');
            const debian = distros.find(d => d.name === 'debian-12');
            
            expect(ubuntu).toBeDefined();
            expect(ubuntu!.available).toBe(true);
            
            expect(debian).toBeDefined();
            expect(debian!.available).toBe(false);
        });
        
        it('should filter available distros for commands', async () => {
            distroManager = new DistroManager(testStorePath);
            const distros = await distroManager.listDistros();
            const available = distros.filter(d => d.available);
            
            expect(available).toHaveLength(1);
            expect(available[0].name).toBe('ubuntu-24.04');
        });
        
        it('should return empty array when no distros are available', async () => {
            // Mock all distros as not downloaded
            mockFs.existsSync.mockImplementation((path) => {
                if (path.toString().includes('catalog.json')) return true;
                if (path.toString().includes('.tar')) return false;
                return false;
            });
            
            distroManager = new DistroManager(testStorePath);
            const distros = await distroManager.listDistros();
            const available = distros.filter(d => d.available);
            
            expect(available).toHaveLength(0);
        });
    });
    
    describe('Default Catalog Creation', () => {
        it('should create a catalog with common distributions', () => {
            let writtenCatalog: DistroCatalog | null = null;
            
            mockFs.writeFileSync.mockImplementation((path, data) => {
                if (path.toString().includes('catalog.json')) {
                    writtenCatalog = JSON.parse(data.toString());
                }
            });
            
            mockFs.existsSync.mockImplementation((path) => {
                if (path.toString().includes('catalog.json')) return false;
                return true;
            });
            
            distroManager = new DistroManager(testStorePath);
            
            expect(writtenCatalog).not.toBeNull();
            
            // Should include common distros
            const distroNames = writtenCatalog!.distributions.map(d => d.name.toLowerCase());
            
            // At least one of these should exist
            const hasCommonDistro = 
                distroNames.some(name => name.includes('ubuntu')) ||
                distroNames.some(name => name.includes('debian')) ||
                distroNames.some(name => name.includes('alpine'));
            
            expect(hasCommonDistro).toBe(true);
        });
    });
});