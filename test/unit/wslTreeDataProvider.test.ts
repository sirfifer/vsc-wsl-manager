/**
 * Unit tests for WSLTreeDataProvider
 * Tests tree view functionality, item creation, and data updates
 */

import * as vscode from 'vscode';
import { WSLTreeDataProvider } from '../../src/wslTreeDataProvider';
import { WSLManager, WSLDistribution } from '../../src/wslManager';
import { distributionGenerators } from '../utils/testDataGenerators';

// Mock vscode module
jest.mock('vscode');

// Mock WSLManager
jest.mock('../../src/wslManager');

describe('WSLTreeDataProvider', () => {
    let treeDataProvider: WSLTreeDataProvider;
    let mockWslManager: jest.Mocked<WSLManager>;
    let mockEventEmitter: any;
    
    beforeEach(() => {
        // Create mock WSL manager
        mockWslManager = new WSLManager() as jest.Mocked<WSLManager>;
        
        // Set up mock event emitter
        mockEventEmitter = {
            fire: jest.fn(),
            event: jest.fn(),
            dispose: jest.fn()
        };
        
        // Mock EventEmitter constructor
        (vscode.EventEmitter as jest.Mock).mockImplementation(() => mockEventEmitter);
        
        // Create tree data provider instance
        treeDataProvider = new WSLTreeDataProvider(mockWslManager);
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
            const mockDistribution = distributionGenerators.createDistribution();
            const treeItem = new vscode.TreeItem(
                mockDistribution.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            
            const result = treeDataProvider.getTreeItem(treeItem as any);
            
            expect(result).toBe(treeItem);
        });
    });
    
    describe('getChildren', () => {
        describe('root level', () => {
            it('should return distribution tree items at root level', async () => {
                const mockDistributions = distributionGenerators.createDistributionList();
                mockWslManager.listDistributions.mockResolvedValue(mockDistributions);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toHaveLength(3);
                expect(mockWslManager.listDistributions).toHaveBeenCalled();
                
                // Verify first distribution
                expect(children[0].label).toBe('Ubuntu');
                expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
                expect(children[0].contextValue).toBe('distribution');
                expect(children[0].description).toBe('Running (default)');
                
                // Verify second distribution
                expect(children[1].label).toBe('Debian');
                expect(children[1].description).toBe('Stopped');
                
                // Verify third distribution
                expect(children[2].label).toBe('Alpine');
                expect(children[2].description).toBe('Running');
            });
            
            it('should return empty array when no distributions exist', async () => {
                mockWslManager.listDistributions.mockResolvedValue([]);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toEqual([]);
            });
            
            it('should handle errors gracefully', async () => {
                mockWslManager.listDistributions.mockRejectedValue(new Error('WSL not found'));
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toEqual([]);
            });
        });
        
        describe('distribution details level', () => {
            it('should return distribution info items for collapsed distribution', async () => {
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
                
                // Create parent tree item
                const parentItem = {
                    label: mockDistribution.name,
                    distribution: mockDistribution,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    type: 'distribution'
                };
                
                const children = await treeDataProvider.getChildren(parentItem as any);
                
                // Should have 6 items: state, version, default flag, OS, kernel, memory
                expect(children).toHaveLength(6);
                expect(mockWslManager.getDistributionInfo).toHaveBeenCalledWith('Ubuntu');
                
                // Verify state item
                expect(children[0].label).toBe('State: Running');
                expect(children[0].contextValue).toBe('info');
                expect(children[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
                
                // Verify version item
                expect(children[1].label).toBe('Version: WSL2');
                
                // Verify default distribution item
                expect(children[2].label).toBe('Default Distribution');
                
                // Verify OS item
                expect(children[3].label).toBe('OS: Ubuntu 22.04.1 LTS');
                
                // Verify kernel item
                expect(children[4].label).toBe('Kernel: 5.15.0-58-generic');
                
                // Verify memory item
                expect(children[5].label).toBe('Memory: 16G');
            });
            
            it('should not show default distribution item for non-default distros', async () => {
                const mockDistribution = distributionGenerators.createDistribution({
                    name: 'Debian',
                    default: false
                });
                
                const mockInfo = {
                    name: 'Debian',
                    os: 'Debian 11',
                    kernel: '5.15.0-58-generic',
                    totalMemory: '8G'
                };
                
                mockWslManager.getDistributionInfo.mockResolvedValue(mockInfo);
                
                const parentItem = {
                    label: mockDistribution.name,
                    distribution: mockDistribution,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    type: 'distribution'
                };
                
                const children = await treeDataProvider.getChildren(parentItem as any);
                
                // Should have 5 items (no default flag)
                expect(children).toHaveLength(5);
                
                // Verify default item is not present
                const labels = children.map(child => child.label);
                expect(labels).not.toContain('Default Distribution');
            });
            
            it('should handle missing distribution info gracefully', async () => {
                const mockDistribution = distributionGenerators.createDistribution();
                const mockInfo = { name: 'Ubuntu' }; // Minimal info
                
                mockWslManager.getDistributionInfo.mockResolvedValue(mockInfo);
                
                const parentItem = {
                    label: mockDistribution.name,
                    distribution: mockDistribution,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    type: 'distribution'
                };
                
                const children = await treeDataProvider.getChildren(parentItem as any);
                
                // Should only have state and version items
                expect(children).toHaveLength(2);
                expect(children[0].label).toBe('State: Running');
                expect(children[1].label).toBe('Version: WSL2');
            });
            
            it('should trim whitespace from info values', async () => {
                const mockDistribution = distributionGenerators.createDistribution();
                const mockInfo = {
                    name: 'Ubuntu',
                    os: '  Ubuntu 22.04.1 LTS  \n',
                    kernel: '\t5.15.0-58-generic\n\n',
                    totalMemory: ' 16G '
                };
                
                mockWslManager.getDistributionInfo.mockResolvedValue(mockInfo);
                
                const parentItem = {
                    label: mockDistribution.name,
                    distribution: mockDistribution,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    type: 'distribution'
                };
                
                const children = await treeDataProvider.getChildren(parentItem as any);
                
                // Find and check trimmed values
                const osItem = children.find(item => item.label?.startsWith('OS:'));
                const kernelItem = children.find(item => item.label?.startsWith('Kernel:'));
                
                expect(osItem?.label).toBe('OS: Ubuntu 22.04.1 LTS');
                expect(kernelItem?.label).toBe('Kernel: 5.15.0-58-generic');
            });
        });
    });
    
    describe('TreeItem properties', () => {
        it('should set correct icon for running distribution', async () => {
            const mockDistribution = distributionGenerators.createDistribution({
                state: 'Running'
            });
            
            mockWslManager.listDistributions.mockResolvedValue([mockDistribution]);
            
            const children = await treeDataProvider.getChildren();
            const treeItem = children[0];
            
            expect(treeItem.iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((treeItem.iconPath as any).id).toBe('vm-active');
            expect((treeItem.iconPath as any).color?.id).toBe('charts.green');
        });
        
        it('should set correct icon for stopped distribution', async () => {
            const mockDistribution = distributionGenerators.createDistribution({
                state: 'Stopped'
            });
            
            mockWslManager.listDistributions.mockResolvedValue([mockDistribution]);
            
            const children = await treeDataProvider.getChildren();
            const treeItem = children[0];
            
            expect(treeItem.iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((treeItem.iconPath as any).id).toBe('vm');
            expect((treeItem.iconPath as any).color?.id).toBe('charts.gray');
        });
        
        it('should set info icon for detail items', async () => {
            const mockDistribution = distributionGenerators.createDistribution();
            const mockInfo = { name: 'Ubuntu' };
            
            mockWslManager.getDistributionInfo.mockResolvedValue(mockInfo);
            
            const parentItem = {
                label: mockDistribution.name,
                distribution: mockDistribution,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                type: 'distribution'
            };
            
            const children = await treeDataProvider.getChildren(parentItem as any);
            const infoItem = children[0];
            
            expect(infoItem.iconPath).toBeInstanceOf(vscode.ThemeIcon);
            expect((infoItem.iconPath as any).id).toBe('info');
        });
        
        it('should set tooltip to match label', async () => {
            const mockDistribution = distributionGenerators.createDistribution();
            mockWslManager.listDistributions.mockResolvedValue([mockDistribution]);
            
            const children = await treeDataProvider.getChildren();
            const treeItem = children[0];
            
            expect(treeItem.tooltip).toBe(treeItem.label);
        });
    });
    
    describe('Event handling', () => {
        it('should properly expose onDidChangeTreeData event', () => {
            expect(treeDataProvider.onDidChangeTreeData).toBe(mockEventEmitter.event);
        });
        
        it('should update tree when distributions change', async () => {
            // Initial state
            mockWslManager.listDistributions.mockResolvedValue([
                distributionGenerators.createDistribution({ name: 'Ubuntu' })
            ]);
            
            let children = await treeDataProvider.getChildren();
            expect(children).toHaveLength(1);
            
            // Update distributions
            mockWslManager.listDistributions.mockResolvedValue([
                distributionGenerators.createDistribution({ name: 'Ubuntu' }),
                distributionGenerators.createDistribution({ name: 'Debian' })
            ]);
            
            // Refresh and get new children
            treeDataProvider.refresh();
            children = await treeDataProvider.getChildren();
            
            expect(children).toHaveLength(2);
            expect(mockEventEmitter.fire).toHaveBeenCalled();
        });
    });
    
    describe('Error scenarios', () => {
        it('should handle getDistributionInfo errors gracefully', async () => {
            const mockDistribution = distributionGenerators.createDistribution();
            
            mockWslManager.getDistributionInfo.mockRejectedValue(
                new Error('Failed to get info')
            );
            
            const parentItem = {
                label: mockDistribution.name,
                distribution: mockDistribution,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                type: 'distribution'
            };
            
            const children = await treeDataProvider.getChildren(parentItem as any);
            
            // Should still return basic items even if info fails
            expect(children.length).toBeGreaterThan(0);
            expect(children[0].label).toContain('State:');
        });
        
        it('should handle null or undefined distribution properties', async () => {
            const mockDistribution: WSLDistribution = {
                name: 'Test',
                state: 'Running',
                version: '2',
                default: false
            };
            
            // Mock info with null/undefined values
            const mockInfo = {
                name: 'Test',
                os: null,
                kernel: undefined,
                totalMemory: ''
            };
            
            mockWslManager.getDistributionInfo.mockResolvedValue(mockInfo);
            
            const parentItem = {
                label: mockDistribution.name,
                distribution: mockDistribution,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                type: 'distribution'
            };
            
            const children = await treeDataProvider.getChildren(parentItem as any);
            
            // Should only show items with valid values
            const labels = children.map(child => child.label);
            expect(labels).toContain('State: Running');
            expect(labels).toContain('Version: WSL2');
            expect(labels).not.toContain('OS: ');
            expect(labels).not.toContain('Kernel: ');
            expect(labels).not.toContain('Memory: ');
        });
    });
});