/**
 * Unit tests for WSLTreeDataProvider
 * Tests two-section tree view functionality (Distributions and Images)
 */

import * as vscode from 'vscode';
import { WSLTreeDataProvider } from '../../src/wslTreeDataProvider';
import { WSLManager, WSLDistribution } from '../../src/wslManager';
import { WSLImageManager, ImageInfo } from '../../src/imageManager';
import { distributionGenerators } from '../utils/testDataGenerators';

// Mock vscode module
jest.mock('vscode');

// Mock WSLManager and WSLImageManager
jest.mock('../../src/wslManager');
jest.mock('../../src/imageManager');

describe('WSLTreeDataProvider', () => {
    let treeDataProvider: WSLTreeDataProvider;
    let mockWslManager: jest.Mocked<WSLManager>;
    let mockImageManager: jest.Mocked<WSLImageManager>;
    let mockEventEmitter: any;
    
    beforeEach(() => {
        // Create mock managers
        mockWslManager = new WSLManager() as jest.Mocked<WSLManager>;
        mockImageManager = new WSLImageManager() as jest.Mocked<WSLImageManager>;
        
        // Set up mock event emitter
        mockEventEmitter = {
            fire: jest.fn(),
            event: jest.fn(),
            dispose: jest.fn()
        };
        
        // Mock EventEmitter constructor
        (vscode.EventEmitter as jest.Mock).mockImplementation(() => mockEventEmitter);
        
        // Create tree data provider instance
        treeDataProvider = new WSLTreeDataProvider(mockWslManager, mockImageManager);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('refresh', () => {
        it('should fire change event when refresh is called', () => {
            treeDataProvider.refresh();
            
            expect(mockEventEmitter.fire).toHaveBeenCalledWith(undefined);
        });
        
        it('should allow multiple refreshes', () => {
            treeDataProvider.refresh();
            treeDataProvider.refresh();
            treeDataProvider.refresh();
            
            expect(mockEventEmitter.fire).toHaveBeenCalledTimes(3);
        });
    });
    
    describe('getTreeItem', () => {
        it('should return the same tree item passed to it', () => {
            const treeItem = new vscode.TreeItem(
                'Test Item',
                vscode.TreeItemCollapsibleState.Collapsed
            );
            
            const result = treeDataProvider.getTreeItem(treeItem as any);
            
            expect(result).toBe(treeItem);
        });
    });
    
    describe('getChildren', () => {
        describe('root level', () => {
            it('should return two main sections at root level', async () => {
                const children = await treeDataProvider.getChildren();
                
                expect(children).toHaveLength(2);
                
                // Verify Distributions section
                expect(children[0].label).toBe('Distributions');
                expect(children[0].type).toBe('section');
                expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
                expect((children[0].iconPath as any).id).toBe('server');
                
                // Verify Images section
                expect(children[1].label).toBe('Images');
                expect(children[1].type).toBe('section');
                expect(children[1].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
                expect((children[1].iconPath as any).id).toBe('package');
            });
        });
        
        describe('Distributions section', () => {
            let distributionsSection: any;
            
            beforeEach(async () => {
                const sections = await treeDataProvider.getChildren();
                distributionsSection = sections[0]; // Distributions section
            });
            
            it('should return Download Distribution button and distributions', async () => {
                const mockDistributions = distributionGenerators.createDistributionList();
                mockWslManager.listDistributions.mockResolvedValue(mockDistributions);
                
                const children = await treeDataProvider.getChildren(distributionsSection);
                
                expect(children).toHaveLength(4); // 1 action button + 3 distributions
                
                // Verify Download Distribution action button
                expect(children[0].label).toBe('Download Distribution');
                expect(children[0].type).toBe('action');
                expect(children[0].command?.command).toBe('wsl-manager.downloadDistribution');
                expect((children[0].iconPath as any).id).toBe('cloud-download');
                expect(children[0].tooltip).toBe('Download and install a new WSL distribution');
                
                // Verify distributions
                expect(children[1].label).toBe('Ubuntu');
                expect(children[1].type).toBe('distribution');
                expect(children[1].description).toBe('Running (default)');
                
                expect(children[2].label).toBe('Debian');
                expect(children[2].type).toBe('distribution');
                expect(children[2].description).toBe('Stopped');
                
                expect(children[3].label).toBe('Alpine');
                expect(children[3].type).toBe('distribution');
                expect(children[3].description).toBe('Running');
            });
            
            it('should return only Download Distribution button when no distributions exist', async () => {
                mockWslManager.listDistributions.mockResolvedValue([]);
                
                const children = await treeDataProvider.getChildren(distributionsSection);
                
                expect(children).toHaveLength(1);
                expect(children[0].label).toBe('Download Distribution');
                expect(children[0].type).toBe('action');
            });
            
            it('should handle distributions with proper icons and descriptions', async () => {
                const runningDistro = distributionGenerators.createDistribution({
                    name: 'Ubuntu',
                    state: 'Running',
                    default: true
                });
                const stoppedDistro = distributionGenerators.createDistribution({
                    name: 'Debian',
                    state: 'Stopped',
                    default: false
                });
                
                mockWslManager.listDistributions.mockResolvedValue([runningDistro, stoppedDistro]);
                
                const children = await treeDataProvider.getChildren(distributionsSection);
                
                // Check running distribution
                const ubuntuItem = children[1];
                expect((ubuntuItem.iconPath as any).id).toBe('vm-active');
                expect((ubuntuItem.iconPath as any).color?.id).toBe('charts.green');
                expect(ubuntuItem.description).toBe('Running (default)');
                
                // Check stopped distribution
                const debianItem = children[2];
                expect((debianItem.iconPath as any).id).toBe('vm');
                expect((debianItem.iconPath as any).color?.id).toBe('charts.gray');
                expect(debianItem.description).toBe('Stopped');
            });
        });
        
        describe('Images section', () => {
            let imagesSection: any;
            
            beforeEach(async () => {
                const sections = await treeDataProvider.getChildren();
                imagesSection = sections[1]; // Images section
            });
            
            it('should return Create Image button and images', async () => {
                const mockImages: ImageInfo[] = [
                    {
                        name: 'dev-env',
                        baseDistribution: 'Ubuntu',
                        created: '2025-01-01T12:00:00Z',
                        size: 1048576,
                        architecture: 'x64',
                        wslVersion: '2.0.0',
                        description: 'Development environment',
                        tags: ['development', 'nodejs']
                    },
                    {
                        name: 'python-env',
                        baseDistribution: 'Debian',
                        created: '2025-01-02T12:00:00Z',
                        size: 2097152,
                        architecture: 'x64',
                        wslVersion: '2.0.0',
                        description: 'Python development environment',
                        tags: ['python', 'data-science']
                    }
                ];
                
                mockImageManager.listImages.mockResolvedValue(mockImages);
                
                const children = await treeDataProvider.getChildren(imagesSection);
                
                expect(children).toHaveLength(3); // 1 action button + 2 images
                
                // Verify Create Image action button
                expect(children[0].label).toBe('Create new Image from Distribution');
                expect(children[0].type).toBe('action');
                expect(children[0].command?.command).toBe('wsl-manager.selectDistributionForImage');
                expect((children[0].iconPath as any).id).toBe('add');
                expect(children[0].tooltip).toBe('Create a reusable image from an existing distribution');
                
                // Verify images
                expect(children[1].label).toBe('dev-env');
                expect(children[1].type).toBe('image');
                expect(children[1].description).toBe('based on Ubuntu');
                expect(children[1].tooltip).toBe('Development environment');
                expect((children[1].iconPath as any).id).toBe('file-zip');
                
                expect(children[2].label).toBe('python-env');
                expect(children[2].type).toBe('image');
                expect(children[2].description).toBe('based on Debian');
                expect(children[2].tooltip).toBe('Python development environment');
            });
            
            it('should return only Create Image button when no images exist', async () => {
                mockImageManager.listImages.mockResolvedValue([]);
                
                const children = await treeDataProvider.getChildren(imagesSection);
                
                expect(children).toHaveLength(1);
                expect(children[0].label).toBe('Create new Image from Distribution');
                expect(children[0].type).toBe('action');
            });
            
            it('should handle image listing errors gracefully', async () => {
                mockImageManager.listImages.mockRejectedValue(new Error('Failed to load images'));
                
                const children = await treeDataProvider.getChildren(imagesSection);
                
                // Should still return action button even if images fail to load
                expect(children).toHaveLength(1);
                expect(children[0].label).toBe('Create new Image from Distribution');
                expect(children[0].type).toBe('action');
            });
        });
        
        describe('distribution details level', () => {
            it('should return distribution info items for distribution', async () => {
                const mockDistribution = distributionGenerators.createDistribution({
                    name: 'Ubuntu',
                    state: 'Running',
                    version: '2',
                    default: true
                });
                
                const mockInfo = {
                    name: 'Ubuntu',
                    os: 'Ubuntu 22.04.1 LTS',
                    kernel: '5.15.0-58-generic',
                    totalMemory: '16G'
                };
                
                mockWslManager.getDistributionInfo.mockResolvedValue(mockInfo);
                
                const distributionItem = {
                    label: mockDistribution.name,
                    distribution: mockDistribution,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    type: 'distribution'
                };
                
                const children = await treeDataProvider.getChildren(distributionItem as any);
                
                expect(children).toHaveLength(6);
                expect(mockWslManager.getDistributionInfo).toHaveBeenCalledWith('Ubuntu');
                
                // Verify info items
                expect(children[0].label).toBe('State: Running');
                expect(children[0].type).toBe('info');
                expect(children[1].label).toBe('Version: WSL2');
                expect(children[2].label).toBe('Default Distribution');
                expect(children[3].label).toBe('OS: Ubuntu 22.04.1 LTS');
                expect(children[4].label).toBe('Kernel: 5.15.0-58-generic');
                expect(children[5].label).toBe('Memory: 16G');
            });
            
            it('should handle minimal distribution info', async () => {
                const mockDistribution = distributionGenerators.createDistribution({
                    name: 'Test',
                    default: false
                });
                
                const mockInfo = { name: 'Test' }; // Minimal info
                
                mockWslManager.getDistributionInfo.mockResolvedValue(mockInfo);
                
                const distributionItem = {
                    label: mockDistribution.name,
                    distribution: mockDistribution,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    type: 'distribution'
                };
                
                const children = await treeDataProvider.getChildren(distributionItem as any);
                
                // Should only have state and version items (no default flag)
                expect(children).toHaveLength(2);
                expect(children[0].label).toBe('State: Running');
                expect(children[1].label).toBe('Version: WSL2');
            });
        });
        
        it('should return empty array for unknown element types', async () => {
            const unknownElement = {
                label: 'Unknown',
                type: 'unknown'
            };
            
            const children = await treeDataProvider.getChildren(unknownElement as any);
            
            expect(children).toEqual([]);
        });
    });
    
    describe('Event handling', () => {
        it('should properly expose onDidChangeTreeData event', () => {
            expect(treeDataProvider.onDidChangeTreeData).toBe(mockEventEmitter.event);
        });
        
        it('should update tree when refresh is called', () => {
            treeDataProvider.refresh();
            
            expect(mockEventEmitter.fire).toHaveBeenCalledWith(undefined);
        });
    });
    
    describe('TreeItem context values', () => {
        it('should set correct context values for different item types', async () => {
            // Test root sections
            const sections = await treeDataProvider.getChildren();
            expect(sections[0].contextValue).toBe('section');
            expect(sections[1].contextValue).toBe('section');
            
            // Test distributions section
            const mockDistributions = [distributionGenerators.createDistribution()];
            mockWslManager.listDistributions.mockResolvedValue(mockDistributions);
            
            const distributionsChildren = await treeDataProvider.getChildren(sections[0]);
            expect(distributionsChildren[0].contextValue).toBe('action'); // Download button
            expect(distributionsChildren[1].contextValue).toBe('distribution'); // Distribution
            
            // Test images section
            const mockImages: ImageInfo[] = [{
                name: 'test-image',
                baseDistribution: 'Ubuntu',
                created: '2025-01-01T12:00:00Z',
                size: 1048576,
                architecture: 'x64',
                wslVersion: '2.0.0'
            }];
            mockImageManager.listImages.mockResolvedValue(mockImages);
            
            const imagesChildren = await treeDataProvider.getChildren(sections[1]);
            expect(imagesChildren[0].contextValue).toBe('action'); // Create button
            expect(imagesChildren[1].contextValue).toBe('image'); // Image
        });
    });
});