/**
 * Unit tests for WSLDistributionTreeDataProvider
 * Tests the Distributions view functionality (no running/stopped status)
 */

import * as vscode from 'vscode';
import { WSLDistributionTreeDataProvider } from '../../src/wslDistributionTreeDataProvider';
import { WSLManager, WSLDistribution } from '../../src/wslManager';
import { distributionGenerators } from '../utils/testDataGenerators';

// Mock vscode module
jest.mock('vscode');

// Mock WSLManager
jest.mock('../../src/wslManager');

describe('WSLDistributionTreeDataProvider', () => {
    let treeDataProvider: WSLDistributionTreeDataProvider;
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
        
        // Mock ThemeIcon
        (vscode.ThemeIcon as any) = jest.fn((icon, color) => ({ id: icon, color }));
        (vscode.ThemeColor as any) = jest.fn((color) => ({ id: color }));
        
        // Create tree data provider instance
        treeDataProvider = new WSLDistributionTreeDataProvider(mockWslManager);
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
                'Ubuntu',
                vscode.TreeItemCollapsibleState.None
            );
            
            const result = treeDataProvider.getTreeItem(treeItem as any);
            expect(result).toBe(treeItem);
        });
    });
    
    describe('getChildren', () => {
        describe('when distributions exist', () => {
            it('should return distribution tree items without running/stopped status', async () => {
                const mockDistributions = [
                    distributionGenerators.createDistribution({
                        name: 'Ubuntu-22.04',
                        state: 'Running', // This should be ignored
                        default: true
                    }),
                    distributionGenerators.createDistribution({
                        name: 'Debian',
                        state: 'Stopped', // This should be ignored
                        default: false
                    })
                ];
                
                mockWslManager.listDistributions.mockResolvedValue(mockDistributions);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toHaveLength(2);
                
                // First distribution - default
                expect(children[0].label).toBe('Ubuntu-22.04');
                expect(children[0].description).toBe('(default)');
                expect(children[0].contextValue).toBe('distribution');
                
                // Second distribution - not default, no status shown
                expect(children[1].label).toBe('Debian');
                expect(children[1].description).toBe('');
                expect(children[1].contextValue).toBe('distribution');
                
                // Verify no running/stopped status is shown
                expect(children[0].description).not.toContain('Running');
                expect(children[1].description).not.toContain('Stopped');
            });
            
            it('should show only default flag when applicable', async () => {
                const mockDistributions = [
                    distributionGenerators.createDistribution({
                        name: 'Ubuntu',
                        default: true
                    })
                ];
                
                mockWslManager.listDistributions.mockResolvedValue(mockDistributions);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children[0].description).toBe('(default)');
            });
            
            it('should handle multiple distributions correctly', async () => {
                const mockDistributions = distributionGenerators.createDistributionList();
                
                mockWslManager.listDistributions.mockResolvedValue(mockDistributions);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toHaveLength(3);
                children.forEach(child => {
                    expect(child.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
                    expect(child.contextValue).toBe('distribution');
                });
            });
        });
        
        describe('when no distributions exist', () => {
            it('should return empty array to trigger welcome view', async () => {
                mockWslManager.listDistributions.mockResolvedValue([]);
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toEqual([]);
            });
        });
        
        describe('error handling', () => {
            it('should return empty array when distribution loading fails', async () => {
                mockWslManager.listDistributions.mockRejectedValue(new Error('WSL not found'));
                
                const children = await treeDataProvider.getChildren();
                
                expect(children).toEqual([]);
            });
        });
    });
    
    describe('TreeItem properties', () => {
        it('should set correct icon for distributions', async () => {
            const mockDistribution = distributionGenerators.createDistribution({
                name: 'Ubuntu'
            });
            
            mockWslManager.listDistributions.mockResolvedValue([mockDistribution]);
            
            const children = await treeDataProvider.getChildren();
            const item = children[0];
            
            expect((item.iconPath as any).id).toBe('server-environment');
        });
        
        it('should create proper tooltip with distribution info', async () => {
            const mockDistribution = distributionGenerators.createDistribution({
                name: 'Ubuntu-22.04',
                version: '2',
                default: true
            });
            
            mockWslManager.listDistributions.mockResolvedValue([mockDistribution]);
            
            const children = await treeDataProvider.getChildren();
            const item = children[0];
            
            // Tooltip should contain name and version but not running status
            expect(item.tooltip).toBeDefined();
        });
        
        it('should not show any running/stopped status in tree items', async () => {
            const mockDistributions = [
                distributionGenerators.createDistribution({
                    name: 'Ubuntu',
                    state: 'Running'
                }),
                distributionGenerators.createDistribution({
                    name: 'Debian',
                    state: 'Stopped'
                })
            ];
            
            mockWslManager.listDistributions.mockResolvedValue(mockDistributions);
            
            const children = await treeDataProvider.getChildren();
            
            // Ensure no status is shown anywhere
            children.forEach(child => {
                expect(child.description || '').not.toMatch(/Running|Stopped/i);
                if (child.tooltip && typeof child.tooltip === 'string') {
                    expect(child.tooltip).not.toMatch(/Running|Stopped/i);
                }
            });
        });
    });
    
    describe('Event handling', () => {
        it('should properly expose onDidChangeTreeData event', () => {
            expect(treeDataProvider.onDidChangeTreeData).toBe(mockEventEmitter.event);
        });
        
        it('should update tree when refresh is called', async () => {
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
            
            // Refresh
            treeDataProvider.refresh();
            children = await treeDataProvider.getChildren();
            
            expect(children).toHaveLength(2);
            expect(mockEventEmitter.fire).toHaveBeenCalled();
        });
    });
});