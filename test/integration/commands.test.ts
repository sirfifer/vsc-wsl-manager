/**
 * Integration tests for command workflows
 * Tests complete command execution flows with all components
 */

import * as vscode from 'vscode';
import { activate } from '../../src/extension';
import { distributionGenerators, pathGenerators } from '../utils/testDataGenerators';

// Mock modules first before any imports that might use them
jest.mock('vscode');
jest.mock('child_process', () => {
    const systemCommands = require('../mocks/systemCommands');
    return {
        exec: systemCommands.mockExec,
        spawn: systemCommands.mockSpawn
    };
});
jest.mock('util', () => ({
    promisify: (fn: Function) => fn
}));
jest.mock('fs', () => {
    const systemCommands = require('../mocks/systemCommands');
    return systemCommands.mockFs;
});

// Import utilities after mocks are configured
import { commandMockUtils } from '../mocks/systemCommands';

describe('Command Integration Tests', () => {
    let mockContext: vscode.ExtensionContext;
    let commandHandlers: { [key: string]: Function } = {};
    
    beforeEach(async () => {
        jest.clearAllMocks();
        commandMockUtils.resetAll();
        
        // Mock extension context
        mockContext = {
            subscriptions: [],
            globalState: {
                get: jest.fn(),
                update: jest.fn().mockResolvedValue(undefined)
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn().mockResolvedValue(undefined)
            },
            extensionPath: '/mock/extension/path'
        } as any;
        
        // Mock VS Code APIs
        (vscode.window.createTreeView as jest.Mock).mockReturnValue({
            visible: true,
            reveal: jest.fn(),
            dispose: jest.fn()
        });
        
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn().mockReturnValue(true),
            update: jest.fn().mockResolvedValue(undefined)
        });
        
        // Capture command handlers
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((command, callback) => {
            commandHandlers[command] = callback;
            return { dispose: jest.fn() };
        });
        
        (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
            const progress = { report: jest.fn() };
            const token = { isCancellationRequested: false };
            return await task(progress, token);
        });
        
        // Set up default WSL list response
        commandMockUtils.setupExecMock('--list --verbose', distributionGenerators.createRawWSLOutput());
        
        // Activate extension
        await activate(mockContext);
    });
    
    describe('Import Distribution Workflow', () => {
        it('should complete full import workflow successfully', async () => {
            const distributionName = 'imported-ubuntu';
            const tarPath = pathGenerators.createPath('tar');
            const installPath = pathGenerators.createPath('dir');
            
            // Mock user inputs
            (vscode.window.showInputBox as jest.Mock)
                .mockResolvedValueOnce(distributionName)
                .mockResolvedValueOnce(installPath);
            
            (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: tarPath }]);
            
            // Mock successful import
            commandMockUtils.setupExecMock('--import', 'Import successful');
            
            // Execute command
            await commandHandlers['wsl-manager.importDistribution']();
            
            // Verify user prompts
            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter distribution name',
                placeHolder: 'imported-wsl'
            });
            
            expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'TAR files': ['tar'] }
            });
            
            // Verify file system operations
            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(installPath, { recursive: true });
            
            // Verify import command
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(`--import "${distributionName}" "${installPath}" "${tarPath}"`),
                expect.any(Function)
            );
            
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                `Distribution '${distributionName}' imported successfully!`
            );
        });
        
        it('should handle import cancellation at each step', async () => {
            // Test cancellation at name input
            (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce(undefined);
            
            await commandHandlers['wsl-manager.importDistribution']();
            
            expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
            expect(mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--import'), expect.any(Function));
            
            // Test cancellation at file selection
            jest.clearAllMocks();
            (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('test-name');
            (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);
            
            await commandHandlers['wsl-manager.importDistribution']();
            
            expect(mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--import'), expect.any(Function));
        });
        
        it('should show error on import failure', async () => {
            (vscode.window.showInputBox as jest.Mock)
                .mockResolvedValueOnce('test-distro')
                .mockResolvedValueOnce('');
            (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: '/test.tar' }]);
            
            commandMockUtils.setupExecMock('--import', '', 'Import failed: Invalid TAR file');
            
            await commandHandlers['wsl-manager.importDistribution']();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to import distribution')
            );
        });
    });
    
    describe('Export Distribution Workflow', () => {
        it('should complete full export workflow successfully', async () => {
            const distribution = distributionGenerators.createDistribution({ name: 'Ubuntu' });
            const exportPath = pathGenerators.createPath('tar');
            
            // Mock save dialog
            (vscode.window.showSaveDialog as jest.Mock).mockResolvedValue({ fsPath: exportPath });
            
            // Mock successful export
            commandMockUtils.setupExecMock('--export', 'Export successful');
            
            // Execute command with distribution item
            await commandHandlers['wsl-manager.exportDistribution'](distribution);
            
            // Verify save dialog
            expect(vscode.window.showSaveDialog).toHaveBeenCalledWith({
                defaultUri: expect.objectContaining({ path: `${distribution.name}.tar` }),
                filters: { 'TAR files': ['tar'] }
            });
            
            // Verify export command
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe --export "${distribution.name}" "${exportPath}"`,
                expect.any(Function)
            );
            
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                `Distribution '${distribution.name}' exported successfully!`
            );
        });
        
        it('should handle export cancellation', async () => {
            const distribution = distributionGenerators.createDistribution();
            
            (vscode.window.showSaveDialog as jest.Mock).mockResolvedValue(undefined);
            
            await commandHandlers['wsl-manager.exportDistribution'](distribution);
            
            expect(mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--export'), expect.any(Function));
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
    });
    
    describe('Delete Distribution Workflow', () => {
        it('should delete distribution after confirmation', async () => {
            const distribution = distributionGenerators.createDistribution({ name: 'TestDistro' });
            
            // Mock confirmation dialog
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Yes');
            
            // Mock successful deletion
            commandMockUtils.setupExecMock('--unregister', 'Unregister successful');
            
            // Execute command
            await commandHandlers['wsl-manager.deleteDistribution'](distribution);
            
            // Verify confirmation prompt
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                `Are you sure you want to delete the distribution '${distribution.name}'? This action cannot be undone.`,
                'Yes',
                'No'
            );
            
            // Verify unregister command
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe --unregister "${distribution.name}"`,
                expect.any(Function)
            );
            
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                `Distribution '${distribution.name}' deleted successfully!`
            );
        });
        
        it('should not delete when user cancels confirmation', async () => {
            const distribution = distributionGenerators.createDistribution();
            
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('No');
            
            await commandHandlers['wsl-manager.deleteDistribution'](distribution);
            
            expect(mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--unregister'), expect.any(Function));
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
        
        it('should handle undefined confirmation response', async () => {
            const distribution = distributionGenerators.createDistribution();
            
            (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
            
            await commandHandlers['wsl-manager.deleteDistribution'](distribution);
            
            expect(mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--unregister'), expect.any(Function));
        });
    });
    
    describe('Create Distribution Workflow', () => {
        it('should complete full creation workflow', async () => {
            const newName = 'my-dev-env';
            const baseDistro = 'Ubuntu';
            
            // Mock user inputs
            (vscode.window.showInputBox as jest.Mock).mockResolvedValue(newName);
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(baseDistro);
            
            // Mock successful creation
            commandMockUtils.setupExecMock('--export', 'Export successful');
            commandMockUtils.setupExecMock('--import', 'Import successful');
            
            // Execute command
            await commandHandlers['wsl-manager.createDistribution']();
            
            // Verify prompts
            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter distribution name',
                placeHolder: 'my-custom-wsl'
            });
            
            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                ['Ubuntu', 'Debian', 'Alpine', 'openSUSE-Leap'],
                { placeHolder: 'Select base distribution' }
            );
            
            // Verify progress notification
            expect(vscode.window.withProgress).toHaveBeenCalledWith(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating WSL distribution: ${newName}`,
                    cancellable: false
                },
                expect.any(Function)
            );
            
            // Verify export and import commands were called
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(`--export "${baseDistro}"`),
                expect.any(Function)
            );
            
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(`--import "${newName}"`),
                expect.any(Function)
            );
            
            // Verify temp file cleanup
            expect(mockFs.promises.unlink).toHaveBeenCalled();
            
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                `Distribution '${newName}' created successfully!`
            );
        });
        
        it('should validate base distribution exists', async () => {
            const newName = 'test-distro';
            const baseDistro = 'NonExistent';
            
            (vscode.window.showInputBox as jest.Mock).mockResolvedValue(newName);
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(baseDistro);
            
            // Mock distributions list without the base distro
            commandMockUtils.setupExecMock('--list --verbose', 
                distributionGenerators.createRawWSLOutput([
                    distributionGenerators.createDistribution({ name: 'Ubuntu' })
                ])
            );
            
            await commandHandlers['wsl-manager.createDistribution']();
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining(`Base distribution '${baseDistro}' is not installed`)
            );
        });
    });
    
    describe('Refresh Distributions Workflow', () => {
        it('should refresh all components', async () => {
            const mockDistributions = distributionGenerators.createDistributionList();
            commandMockUtils.setupExecMock('--list --verbose', distributionGenerators.createRawWSLOutput(mockDistributions));
            
            // Clear previous calls from activation
            jest.clearAllMocks();
            
            await commandHandlers['wsl-manager.refreshDistributions']();
            
            // Verify WSL list was called
            expect(mockExec).toHaveBeenCalledWith(
                'wsl.exe --list --verbose',
                expect.any(Function)
            );
            
            // Tree refresh and terminal profile update should have been called
            // (These are verified in the mock implementations)
        });
        
        it('should handle refresh errors gracefully', async () => {
            commandMockUtils.setupExecMock('--list', '', 'WSL not found');
            
            // Should not throw
            await expect(commandHandlers['wsl-manager.refreshDistributions']()).resolves.not.toThrow();
        });
    });
    
    describe('Error Recovery', () => {
        it('should show appropriate error messages for common failures', async () => {
            const scenarios = [
                {
                    command: 'wsl-manager.createDistribution',
                    setup: () => {
                        (vscode.window.showInputBox as jest.Mock).mockResolvedValue('test');
                        (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('Ubuntu');
                        commandMockUtils.setupExecMock('--export', '', 'Access denied');
                    },
                    expectedError: 'Failed to create distribution'
                },
                {
                    command: 'wsl-manager.importDistribution',
                    setup: () => {
                        (vscode.window.showInputBox as jest.Mock).mockResolvedValue('test');
                        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: '/test.tar' }]);
                        commandMockUtils.setupExecMock('--import', '', 'Disk full');
                    },
                    expectedError: 'Failed to import distribution'
                },
                {
                    command: 'wsl-manager.exportDistribution',
                    setup: () => {
                        (vscode.window.showSaveDialog as jest.Mock).mockResolvedValue({ fsPath: '/test.tar' });
                        commandMockUtils.setupExecMock('--export', '', 'Distribution not found');
                    },
                    expectedError: 'Failed to export distribution'
                }
            ];
            
            for (const scenario of scenarios) {
                jest.clearAllMocks();
                scenario.setup();
                
                const item = distributionGenerators.createDistribution();
                await commandHandlers[scenario.command](item);
                
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    expect.stringContaining(scenario.expectedError)
                );
            }
        });
    });
    
    describe('Progress Reporting', () => {
        it('should report progress during long operations', async () => {
            let progressReporter: any;
            
            (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                progressReporter = { report: jest.fn() };
                const token = { isCancellationRequested: false };
                return await task(progressReporter, token);
            });
            
            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('test');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('Ubuntu');
            commandMockUtils.setupExecMock('--export', 'Success');
            commandMockUtils.setupExecMock('--import', 'Success');
            
            await commandHandlers['wsl-manager.createDistribution']();
            
            expect(progressReporter.report).toHaveBeenCalledWith({
                increment: 0,
                message: 'Downloading base image...'
            });
            
            expect(progressReporter.report).toHaveBeenCalledWith({
                increment: 100,
                message: 'Complete!'
            });
        });
    });
});