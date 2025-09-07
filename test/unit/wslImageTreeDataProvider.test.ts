/**
 * Unit tests for WSLImageTreeDataProvider
 * Tests the Images view functionality including enabled/disabled states
 */

import * as vscode from 'vscode';
import { WSLImageTreeDataProvider } from '../../src/wslImageTreeDataProvider';
import { WSLImageManager, ImageInfo } from '../../src/imageManager';

// Mock vscode module
jest.mock('vscode');

// Mock WSLImageManager
jest.mock('../../src/imageManager');

describe('WSLImageTreeDataProvider', () => {
    let treeDataProvider: WSLImageTreeDataProvider;
    let mockImageManager: jest.Mocked<WSLImageManager>;
    let mockEventEmitter: any;
    
    beforeEach(() => {
        // Create mock image manager
        mockImageManager = new WSLImageManager() as jest.Mocked<WSLImageManager>;
        
        // Set up mock event emitter
        mockEventEmitter = {
            fire: jest.fn(),
            event: jest.fn(),
            dispose: jest.fn()
        };
        
        // Mock EventEmitter constructor
        (vscode.EventEmitter as jest.Mock).mockImplementation(() => mockEventEmitter);
        
        // Mock ThemeIcon
        (vscode.ThemeIcon as any) = jest.fn((icon, color) => ({ id: icon, color }));
        (vscode.ThemeColor as any) = jest.fn((color) => ({ id: color }));
        
        // Create tree data provider instance
        treeDataProvider = new WSLImageTreeDataProvider(mockImageManager);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('refresh', () => {
        it('should fire change event when refresh is called', () => {
            treeDataProvider.refresh();
            expect(mockEventEmitter.fire).toHaveBeenCalled();
        });
    });
    
    describe('getTreeItem', () => {
        it('should return the same tree item passed to it', () => {
            const treeItem = new vscode.TreeItem(
                'Test Image',
                vscode.TreeItemCollapsibleState.None
            );
            
            const result = treeDataProvider.getTreeItem(treeItem as any);
            expect(result).toBe(treeItem);
        });
    });
    
    describe('getChildren', () => {
        describe('when images exist', () => {
            it('should return image tree items for enabled images', async () => {
                const mockImages: ImageInfo[] = [
                    {
                        name: 'dev-environment',
                        enabled: true,
                        baseDistribution: 'Ubuntu-22.04',
                        description: 'Development environment',
                        created: '2025-01-01T12:00:00Z',
                        size: 1048576,
                        architecture: 'x64',
                        wslVersion: '2.0.0'
                    }
                ];
                
                mockImageManager.listImages.mockResolvedValue(mockImages);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toHaveLength(1);
                expect(children[0].label).toBe('dev-environment');
                expect(children[0].contextValue).toBe('image-enabled');
                expect(children[0].description).toBe('Ubuntu-22.04');
            });
            
            it('should show disabled images with proper styling', async () => {
                const mockImages: ImageInfo[] = [
                    {
                        name: 'python-setup',
                        enabled: false,
                        baseDistribution: 'Ubuntu-22.04',
                        description: 'Python development',
                        created: '2025-01-01T12:00:00Z',
                        size: 1048576,
                        architecture: 'x64',
                        wslVersion: '2.0.0'
                    }
                ];
                
                mockImageManager.listImages.mockResolvedValue(mockImages);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toHaveLength(1);
                expect(children[0].label).toBe('python-setup');
                expect(children[0].contextValue).toBe('image-disabled');
                expect(children[0].description).toBe('Ubuntu-22.04 (disabled)');
                
                // Check for disabled styling
                const iconPath = children[0].iconPath as any;
                expect(iconPath.color?.id).toBe('disabledForeground');
            });
            
            it('should handle images created from other images', async () => {
                const mockImages: ImageInfo[] = [
                    {
                        name: 'node-workspace',
                        enabled: true,
                        baseImage: 'dev-environment',
                        description: 'Node.js workspace',
                        created: '2025-01-01T12:00:00Z',
                        size: 1048576,
                        architecture: 'x64',
                        wslVersion: '2.0.0'
                    }
                ];
                
                mockImageManager.listImages.mockResolvedValue(mockImages);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toHaveLength(1);
                expect(children[0].description).toBe('dev-environment');
            });
        });
        
        describe('when no images exist', () => {
            it('should return empty array to trigger welcome view', async () => {
                mockImageManager.listImages.mockResolvedValue([]);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toEqual([]);
            });
        });
        
        describe('error handling', () => {
            it('should return empty array when image loading fails', async () => {
                mockImageManager.listImages.mockRejectedValue(new Error('Failed to load images'));
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toEqual([]);
            });
        });
    });
    
    describe('Event handling', () => {
        it('should properly expose onDidChangeTreeData event', () => {
            expect(treeDataProvider.onDidChangeTreeData).toBe(mockEventEmitter.event);
        });
    });
    
    describe('TreeItem properties', () => {
        it('should set correct properties for enabled images', async () => {
            const mockImage: ImageInfo = {
                name: 'test-image',
                enabled: true,
                baseDistribution: 'Ubuntu',
                description: 'Test description',
                created: '2025-01-01T12:00:00Z',
                size: 1048576,
                architecture: 'x64',
                wslVersion: '2.0.0'
            };
            
            mockImageManager.listImages.mockResolvedValue([mockImage]);
            
            const children = await treeDataProvider.getChildren();
            const item = children[0];
            
            expect(item.label).toBe('test-image');
            expect(item.contextValue).toBe('image-enabled');
            expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
            expect((item.iconPath as any).id).toBe('package');
            expect((item.iconPath as any).color).toBeUndefined();
        });
        
        it('should set correct properties for disabled images', async () => {
            const mockImage: ImageInfo = {
                name: 'test-image',
                enabled: false,
                baseDistribution: 'Ubuntu',
                description: 'Test description',
                created: '2025-01-01T12:00:00Z',
                size: 1048576,
                architecture: 'x64',
                wslVersion: '2.0.0'
            };
            
            mockImageManager.listImages.mockResolvedValue([mockImage]);
            
            const children = await treeDataProvider.getChildren();
            const item = children[0];
            
            expect(item.label).toBe('test-image');
            expect(item.contextValue).toBe('image-disabled');
            expect((item.iconPath as any).color?.id).toBe('disabledForeground');
        });
    });
    
    describe('Integration with terminal profiles', () => {
        it('should only include enabled images for terminal profile registration', async () => {
            const mockImages: ImageInfo[] = [
                {
                    name: 'enabled-image',
                    enabled: true,
                    baseDistribution: 'Ubuntu',
                    created: '2025-01-01T12:00:00Z',
                    size: 1048576,
                    architecture: 'x64',
                    wslVersion: '2.0.0'
                },
                {
                    name: 'disabled-image',
                    enabled: false,
                    baseDistribution: 'Debian',
                    created: '2025-01-01T12:00:00Z',
                    size: 1048576,
                    architecture: 'x64',
                    wslVersion: '2.0.0'
                }
            ];
            
            mockImageManager.listImages.mockResolvedValue(mockImages);
            
            const enabledImages = await treeDataProvider.getEnabledImages();
            
            expect(enabledImages).toHaveLength(1);
            expect(enabledImages[0].name).toBe('enabled-image');
        });
    });
});