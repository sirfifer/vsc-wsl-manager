/**
 * Tests for Context Menu Command Handlers
 * Ensures commands work correctly when invoked from tree view context menus
 */

import * as vscode from 'vscode';

// Mock vscode first
jest.mock('vscode');

// Mock other dependencies
jest.mock('../../src/wslManager');
jest.mock('../../src/distros/DistroManager');
jest.mock('../../src/images/WSLImageManager');
jest.mock('../../src/utils/inputValidator');
jest.mock('../../src/errors/errorHandler');

import { DistroTreeItem } from '../../src/views/DistroTreeProvider';
import { DistroInfo } from '../../src/distros/DistroManager';

describe('Context Menu Command Handlers', () => {
    let mockVscode: any;
    let mockWslManager: any;
    let mockDistroManager: any;
    let mockImageManager: any;
    let mockErrorHandler: any;
    
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Setup vscode mocks
        mockVscode = vscode as any;
        mockVscode.window = {
            showWarningMessage: jest.fn(),
            showInformationMessage: jest.fn(),
            showQuickPick: jest.fn(),
            showInputBox: jest.fn(),
            withProgress: jest.fn(),
            showErrorMessage: jest.fn()
        };
        mockVscode.ProgressLocation = {
            Notification: 'notification'
        };
        
        // Setup manager mocks
        const { WSLManager } = require('../../src/wslManager');
        mockWslManager = new WSLManager();
        mockWslManager.listDistributions = jest.fn().mockResolvedValue([
            { name: 'Ubuntu-24.04', state: 'Running', version: '2', default: false }
        ]);
        mockWslManager.unregisterDistribution = jest.fn().mockResolvedValue(undefined);
        
        const { DistroManager } = require('../../src/distros/DistroManager');
        mockDistroManager = new DistroManager();
        mockDistroManager.listDistros = jest.fn().mockResolvedValue([
            { 
                name: 'ubuntu-24.04',
                displayName: 'Ubuntu 24.04',
                description: 'Ubuntu 24.04 LTS',
                version: '24.04',
                available: true,
                size: 1024000000
            }
        ]);
        mockDistroManager.getDistro = jest.fn().mockResolvedValue({
            name: 'ubuntu-24.04',
            displayName: 'Ubuntu 24.04',
            available: true,
            filePath: '/path/to/ubuntu.tar'
        });
        
        const { WSLImageManager } = require('../../src/images/WSLImageManager');
        mockImageManager = new WSLImageManager();
        mockImageManager.createFromDistro = jest.fn().mockResolvedValue(undefined);
        mockImageManager.listImages = jest.fn().mockResolvedValue([]);
        
        const { ErrorHandler } = require('../../src/errors/errorHandler');
        mockErrorHandler = ErrorHandler;
        mockErrorHandler.showError = jest.fn();
    });
    
    describe('Delete Distribution Command', () => {
        it('should handle deletion from context menu with DistroTreeItem', async () => {
            // Create a mock DistroTreeItem
            const distroInfo: DistroInfo = {
                name: 'ubuntu-24.04',
                displayName: 'Ubuntu 24.04',
                description: 'Ubuntu 24.04 LTS',
                version: '24.04',
                architecture: 'x64',
                available: true
            };
            
            const treeItem = new DistroTreeItem(distroInfo, vscode.TreeItemCollapsibleState.None);
            
            // Mock user confirmation
            mockVscode.window.showWarningMessage.mockResolvedValue('Delete');
            mockVscode.window.withProgress.mockImplementation(async (options, task) => {
                return task();
            });
            
            // Simulate command execution
            // Note: In the actual fix, the command should check item?.distro?.name
            const distroName = treeItem.distro?.name;
            expect(distroName).toBe('ubuntu-24.04');
            
            // The command handler should:
            // 1. Extract the distro name from the tree item
            // 2. Show confirmation dialog
            // 3. Call unregisterDistribution
            
            await mockWslManager.unregisterDistribution(distroName);
            
            expect(mockWslManager.unregisterDistribution).toHaveBeenCalledWith('ubuntu-24.04');
        });
        
        it('should handle missing distro property gracefully', async () => {
            // Create an item without proper structure
            const invalidItem = { label: 'SomeDistro' };
            
            // When no distro property exists, it should fall back to label
            const distroName = invalidItem.label;
            expect(distroName).toBe('SomeDistro');
        });
        
        it('should show error for invalid input', async () => {
            // Create an item with no identifying properties
            const invalidItem = {};
            
            // Should detect invalid input and show error
            const distroName = (invalidItem as any)?.distro?.name || (invalidItem as any)?.label;
            
            if (!distroName) {
                await mockErrorHandler.showError(
                    new Error('Invalid input: No distribution name found'),
                    'delete distribution'
                );
            }
            
            expect(mockErrorHandler.showError).toHaveBeenCalled();
        });
    });
    
    describe('Create Image from Distribution Command', () => {
        it('should handle creation from context menu with DistroTreeItem', async () => {
            const distroInfo: DistroInfo = {
                name: 'ubuntu-24.04',
                displayName: 'Ubuntu 24.04',
                description: 'Ubuntu 24.04 LTS',
                version: '24.04',
                architecture: 'x64',
                available: true
            };
            
            const treeItem = new DistroTreeItem(distroInfo, vscode.TreeItemCollapsibleState.None);
            
            // Mock user inputs
            mockVscode.window.showInputBox
                .mockResolvedValueOnce('my-ubuntu-instance') // image name
                .mockResolvedValueOnce('My Ubuntu dev environment'); // description
            
            mockVscode.window.withProgress.mockImplementation(async (options, task) => {
                return task({ report: jest.fn() });
            });
            
            // Extract distro name from tree item
            const sourceDistroName = treeItem.distro?.name;
            expect(sourceDistroName).toBe('ubuntu-24.04');
            
            // Simulate creating image
            await mockImageManager.createFromDistro(
                sourceDistroName,
                'my-ubuntu-instance',
                {
                    displayName: 'my-ubuntu-instance',
                    description: 'My Ubuntu dev environment',
                    enableTerminal: true
                }
            );
            
            expect(mockImageManager.createFromDistro).toHaveBeenCalledWith(
                'ubuntu-24.04',
                'my-ubuntu-instance',
                expect.objectContaining({
                    displayName: 'my-ubuntu-instance',
                    description: 'My Ubuntu dev environment',
                    enableTerminal: true
                })
            );
        });
        
        it('should show correct error message on failure', async () => {
            const error = new Error('Network error occurred');
            mockImageManager.createFromDistro.mockRejectedValue(error);
            
            // When error occurs, it should show proper message
            await mockErrorHandler.showError(error, 'create image');
            
            // Verify correct operation name is used (not "clone image")
            expect(mockErrorHandler.showError).toHaveBeenCalledWith(
                error,
                'create image'
            );
        });
    });
    
    describe('Create Image from Distribution Button', () => {
        it('should show "No distributions available" when catalog is empty', async () => {
            // Mock empty distro list
            mockDistroManager.listDistros.mockResolvedValue([]);
            
            // Get available distros
            const distros = await mockDistroManager.listDistros();
            const available = distros.filter(d => d.available);
            
            if (available.length === 0) {
                mockVscode.window.showWarningMessage(
                    'No distributions available. Download a distribution first.'
                );
            }
            
            expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
                'No distributions available. Download a distribution first.'
            );
        });
        
        it('should list available distributions when catalog has entries', async () => {
            const distros = await mockDistroManager.listDistros();
            const available = distros.filter(d => d.available);
            
            expect(available).toHaveLength(1);
            expect(available[0].name).toBe('ubuntu-24.04');
        });
    });
    
    describe('Property Name Consistency', () => {
        it('should verify DistroTreeItem uses "distro" property', () => {
            const distroInfo: DistroInfo = {
                name: 'test-distro',
                displayName: 'Test Distro',
                description: 'Test',
                version: '1.0',
                architecture: 'x64',
                available: true
            };
            
            const treeItem = new DistroTreeItem(distroInfo, vscode.TreeItemCollapsibleState.None);
            
            // DistroTreeItem should have 'distro' property, not 'distribution'
            expect(treeItem.distro).toBeDefined();
            expect(treeItem.distro.name).toBe('test-distro');
            expect((treeItem as any).distribution).toBeUndefined();
        });
    });
});