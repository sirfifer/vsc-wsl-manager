/**
 * Integration tests for extension activation and initialization
 * Tests the complete extension lifecycle and component integration
 */

import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/extension';
import { WSLManager } from '../../src/wslManager';
import { WSLImageManager } from '../../src/imageManager';
import { WSLTreeDataProvider } from '../../src/wslTreeDataProvider';
import { WSLTerminalProfileManager } from '../../src/terminal/wslTerminalProfileProvider';
import { distributionGenerators } from '../utils/testDataGenerators';

// Mock all modules first
jest.mock('vscode');
jest.mock('../../src/wslManager');
jest.mock('../../src/wslTreeDataProvider');
jest.mock('../../src/terminal/wslTerminalProfileProvider');
jest.mock('../../src/imageManager');
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

// Import utilities after mocks are configured
import { commandMockUtils } from '../mocks/systemCommands';

describe('Extension Integration Tests', () => {
    let mockContext: vscode.ExtensionContext;
    let mockTreeView: any;
    let mockWSLManager: jest.Mocked<WSLManager>;
    let mockImageManager: jest.Mocked<WSLImageManager>;
    let mockTreeDataProvider: jest.Mocked<WSLTreeDataProvider>;
    let mockTerminalProfileManager: jest.Mocked<WSLTerminalProfileManager>;
    
    beforeEach(() => {
        // Reset all mocks
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
            extensionPath: '/mock/extension/path',
            asAbsolutePath: jest.fn(path => `/mock/extension/path/${path}`)
        } as any;
        
        // Mock tree view
        mockTreeView = {
            visible: true,
            selection: [],
            reveal: jest.fn(),
            dispose: jest.fn()
        };
        
        (vscode.window.createTreeView as jest.Mock).mockReturnValue(mockTreeView);
        
        // Mock workspace configuration
        const mockConfig = {
            get: jest.fn().mockReturnValue(true), // autoRegisterProfiles = true
            update: jest.fn().mockResolvedValue(undefined)
        };
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
        
        // Mock commands.registerCommand to capture registered commands
        (vscode.commands.registerCommand as jest.Mock).mockImplementation((command, callback) => ({
            dispose: jest.fn()
        }));
        
        // Set up mock implementations
        mockWSLManager = new WSLManager() as jest.Mocked<WSLManager>;
        mockImageManager = new WSLImageManager('/mock/images/path') as jest.Mocked<WSLImageManager>;
        mockTreeDataProvider = new WSLTreeDataProvider(mockWSLManager, mockImageManager) as jest.Mocked<WSLTreeDataProvider>;
        mockTerminalProfileManager = new WSLTerminalProfileManager() as jest.Mocked<WSLTerminalProfileManager>;
        
        // Add mock methods to mockTerminalProfileManager
        mockTerminalProfileManager.updateProfiles = jest.fn();
        mockTerminalProfileManager.dispose = jest.fn();
        
        // Add mock methods to mockImageManager
        mockImageManager.listImages = jest.fn().mockResolvedValue([]);
        
        // Mock constructors
        (WSLManager as jest.Mock).mockImplementation(() => mockWSLManager);
        (WSLImageManager as jest.Mock).mockImplementation(() => mockImageManager);
        (WSLTreeDataProvider as jest.Mock).mockImplementation(() => mockTreeDataProvider);
        (WSLTerminalProfileManager as jest.Mock).mockImplementation(() => mockTerminalProfileManager);
    });
    
    describe('Extension Activation', () => {
        it('should activate extension and initialize all components', async () => {
            const mockDistributions = distributionGenerators.createDistributionList();
            mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
            
            await activate(mockContext);
            
            // Verify components were created
            expect(WSLManager).toHaveBeenCalled();
            expect(WSLImageManager).toHaveBeenCalled();
            expect(WSLTreeDataProvider).toHaveBeenCalled();
            expect(WSLTerminalProfileManager).toHaveBeenCalled();
            
            // Verify tree view was created
            expect(vscode.window.createTreeView).toHaveBeenCalledWith('wslDistributions', {
                treeDataProvider: mockTreeDataProvider,
                showCollapseAll: true
            });
            
            // Verify console log
            expect(console.log).toHaveBeenCalledWith('WSL Manager extension is now active!');
        });
        
        it('should register all required commands', async () => {
            await activate(mockContext);
            
            const registeredCommands = (vscode.commands.registerCommand as jest.Mock).mock.calls.map(call => call[0]);
            
            expect(registeredCommands).toContain('wsl-manager.refreshDistributions');
            expect(registeredCommands).toContain('wsl-manager.createDistribution');
            expect(registeredCommands).toContain('wsl-manager.importDistribution');
            expect(registeredCommands).toContain('wsl-manager.exportDistribution');
            expect(registeredCommands).toContain('wsl-manager.deleteDistribution');
            expect(registeredCommands).toContain('wsl-manager.openTerminal');
            
            // Verify correct number of commands
            expect(registeredCommands).toHaveLength(6);
        });
        
        it('should add all disposables to context subscriptions', async () => {
            await activate(mockContext);
            
            // 6 commands + potential configuration watcher
            expect(mockContext.subscriptions.length).toBeGreaterThanOrEqual(6);
            
            // Verify all items in subscriptions have dispose method
            mockContext.subscriptions.forEach(subscription => {
                expect(subscription).toHaveProperty('dispose');
                expect(typeof subscription.dispose).toBe('function');
            });
        });
        
        it('should execute auto-refresh on activation', async () => {
            const mockDistributions = distributionGenerators.createDistributionList();
            mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
            
            // Mock executeCommand
            (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);
            
            await activate(mockContext);
            
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('wsl-manager.refreshDistributions');
        });
        
        it('should register configuration change listener when autoRegisterProfiles is true', async () => {
            const mockConfig = {
                get: jest.fn().mockReturnValue(true) // autoRegisterProfiles = true
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            await activate(mockContext);
            
            // Verify configuration watcher was set up
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
            
            // Should have added the configuration listener to subscriptions
            const hasConfigListener = mockContext.subscriptions.length > 6;
            expect(hasConfigListener).toBe(true);
        });
        
        it('should not register configuration listener when autoRegisterProfiles is false', async () => {
            const mockConfig = {
                get: jest.fn().mockReturnValue(false) // autoRegisterProfiles = false
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            await activate(mockContext);
            
            // Should only have the 6 command subscriptions
            expect(mockContext.subscriptions).toHaveLength(6);
        });
    });
    
    describe('Command Handlers', () => {
        let commandHandlers: { [key: string]: Function } = {};
        
        beforeEach(async () => {
            // Capture command handlers during registration
            (vscode.commands.registerCommand as jest.Mock).mockImplementation((command, callback) => {
                commandHandlers[command] = callback;
                return { dispose: jest.fn() };
            });
            
            await activate(mockContext);
        });
        
        describe('refreshDistributions command', () => {
            it('should refresh tree view and update terminal profiles', async () => {
                const mockDistributions = distributionGenerators.createDistributionList();
                mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
                
                await commandHandlers['wsl-manager.refreshDistributions']();
                
                expect(mockTreeDataProvider.refresh).toHaveBeenCalled();
                expect(mockWSLManager.listDistributions).toHaveBeenCalled();
                expect(mockTerminalProfileManager.updateProfiles).toHaveBeenCalledWith(mockDistributions, []);
            });
        });
        
        describe('createDistribution command', () => {
            it('should create distribution with user input', async () => {
                // Mock user inputs
                (vscode.window.showInputBox as jest.Mock).mockResolvedValue('test-distro');
                (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('Ubuntu');
                (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                    const progress = { report: jest.fn() };
                    const token = { isCancellationRequested: false };
                    return await task(progress, token);
                });
                
                mockWSLManager.createDistribution.mockResolvedValue(undefined);
                mockWSLManager.listDistributions.mockResolvedValue([]);
                
                await commandHandlers['wsl-manager.createDistribution']();
                
                expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                    prompt: 'Enter distribution name',
                    placeHolder: 'my-custom-wsl'
                });
                
                expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                    ['Ubuntu', 'Debian', 'Alpine', 'openSUSE-Leap'],
                    { placeHolder: 'Select base distribution' }
                );
                
                expect(mockWSLManager.createDistribution).toHaveBeenCalledWith('test-distro', 'Ubuntu');
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                    "Distribution 'test-distro' created successfully!"
                );
            });
            
            it('should handle user cancellation', async () => {
                (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);
                
                await commandHandlers['wsl-manager.createDistribution']();
                
                expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
                expect(mockWSLManager.createDistribution).not.toHaveBeenCalled();
            });
            
            it('should show error message on failure', async () => {
                (vscode.window.showInputBox as jest.Mock).mockResolvedValue('test-distro');
                (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('Ubuntu');
                (vscode.window.withProgress as jest.Mock).mockImplementation(async (options, task) => {
                    const progress = { report: jest.fn() };
                    const token = { isCancellationRequested: false };
                    return await task(progress, token);
                });
                
                mockWSLManager.createDistribution.mockRejectedValue(new Error('Creation failed'));
                
                await commandHandlers['wsl-manager.createDistribution']();
                
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    'Failed to create distribution: Error: Creation failed'
                );
            });
        });
        
        describe('openTerminal command', () => {
            it('should create terminal with correct parameters', () => {
                const mockItem = {
                    name: 'Ubuntu',
                    distribution: distributionGenerators.createDistribution()
                };
                
                const mockTerminal = {
                    show: jest.fn()
                };
                
                (vscode.window.createTerminal as jest.Mock).mockReturnValue(mockTerminal);
                
                commandHandlers['wsl-manager.openTerminal'](mockItem);
                
                expect(vscode.window.createTerminal).toHaveBeenCalledWith({
                    name: 'WSL: Ubuntu',
                    shellPath: 'wsl.exe',
                    shellArgs: ['-d', 'Ubuntu']
                });
                
                expect(mockTerminal.show).toHaveBeenCalled();
            });
        });
    });
    
    describe('Configuration Change Handling', () => {
        it('should update terminal profiles when configuration changes', async () => {
            const mockConfig = {
                get: jest.fn().mockReturnValue(true) // autoRegisterProfiles = true
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            let configChangeHandler: Function = jest.fn();
            (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
                configChangeHandler = handler;
                return { dispose: jest.fn() };
            });
            
            await activate(mockContext);
            
            // Simulate configuration change
            const mockDistributions = distributionGenerators.createDistributionList();
            mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
            
            const changeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(true)
            };
            
            await configChangeHandler(changeEvent);
            
            expect(changeEvent.affectsConfiguration).toHaveBeenCalledWith('terminal.integrated.profiles.windows');
            expect(mockWSLManager.listDistributions).toHaveBeenCalled();
            expect(mockTerminalProfileManager.updateProfiles).toHaveBeenCalledWith(mockDistributions, []);
        });
        
        it('should not update profiles for unrelated configuration changes', async () => {
            const mockConfig = {
                get: jest.fn().mockReturnValue(true)
            };
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
            
            let configChangeHandler: Function = jest.fn();
            (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
                configChangeHandler = handler;
                return { dispose: jest.fn() };
            });
            
            await activate(mockContext);
            
            const changeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(false)
            };
            
            await configChangeHandler(changeEvent);
            
            expect(mockWSLManager.listDistributions).not.toHaveBeenCalled();
            expect(mockTerminalProfileManager.updateProfiles).not.toHaveBeenCalled();
        });
    });
    
    describe('Extension Deactivation', () => {
        it('should log deactivation message', () => {
            deactivate();
            
            expect(console.log).toHaveBeenCalledWith('WSL Manager extension is now deactivated');
        });
        
        it('should be safe to call multiple times', () => {
            deactivate();
            deactivate();
            deactivate();
            
            expect(console.log).toHaveBeenCalledTimes(3);
        });
    });
    
    describe('Error Handling', () => {
        it('should handle WSL manager initialization failure gracefully', async () => {
            (WSLManager as jest.Mock).mockImplementation(() => {
                throw new Error('WSL not available');
            });
            
            // Should not throw during activation
            await expect(activate(mockContext)).resolves.not.toThrow();
        });
        
        it('should handle tree view creation failure', async () => {
            (vscode.window.createTreeView as jest.Mock).mockImplementation(() => {
                throw new Error('Tree view creation failed');
            });
            
            // Should not throw during activation
            await expect(activate(mockContext)).resolves.not.toThrow();
        });
    });
});