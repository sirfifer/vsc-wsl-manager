"use strict";
/**
 * Integration tests for extension activation and initialization
 * Tests the complete extension lifecycle and component integration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const extension_1 = require("../../src/extension");
const wslManager_1 = require("../../src/wslManager");
const wslTreeDataProvider_1 = require("../../src/wslTreeDataProvider");
const terminalProfileManager_1 = require("../../src/terminalProfileManager");
const testDataGenerators_1 = require("../utils/testDataGenerators");
const systemCommands_1 = require("../mocks/systemCommands");
// Mock all modules
jest.mock('vscode');
jest.mock('../../src/wslManager');
jest.mock('../../src/wslTreeDataProvider');
jest.mock('../../src/terminalProfileManager');
jest.mock('child_process', () => ({
    exec: systemCommands_1.mockExec
}));
jest.mock('util', () => ({
    promisify: (fn) => fn
}));
describe('Extension Integration Tests', () => {
    let mockContext;
    let mockTreeView;
    let mockWSLManager;
    let mockTreeDataProvider;
    let mockTerminalProfileManager;
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        systemCommands_1.commandMockUtils.resetAll();
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
        };
        // Mock tree view
        mockTreeView = {
            visible: true,
            selection: [],
            reveal: jest.fn(),
            dispose: jest.fn()
        };
        vscode.window.createTreeView.mockReturnValue(mockTreeView);
        // Mock workspace configuration
        const mockConfig = {
            get: jest.fn().mockReturnValue(true),
            update: jest.fn().mockResolvedValue(undefined)
        };
        vscode.workspace.getConfiguration.mockReturnValue(mockConfig);
        // Mock commands.registerCommand to capture registered commands
        vscode.commands.registerCommand.mockImplementation((command, callback) => ({
            dispose: jest.fn()
        }));
        // Set up mock implementations
        mockWSLManager = new wslManager_1.WSLManager();
        mockTreeDataProvider = new wslTreeDataProvider_1.WSLTreeDataProvider(mockWSLManager);
        mockTerminalProfileManager = new terminalProfileManager_1.TerminalProfileManager(mockContext);
        // Mock constructors
        wslManager_1.WSLManager.mockImplementation(() => mockWSLManager);
        wslTreeDataProvider_1.WSLTreeDataProvider.mockImplementation(() => mockTreeDataProvider);
        terminalProfileManager_1.TerminalProfileManager.mockImplementation(() => mockTerminalProfileManager);
    });
    describe('Extension Activation', () => {
        it('should activate extension and initialize all components', async () => {
            const mockDistributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
            await (0, extension_1.activate)(mockContext);
            // Verify components were created
            expect(wslManager_1.WSLManager).toHaveBeenCalled();
            expect(wslTreeDataProvider_1.WSLTreeDataProvider).toHaveBeenCalledWith(mockWSLManager);
            expect(terminalProfileManager_1.TerminalProfileManager).toHaveBeenCalledWith(mockContext);
            // Verify tree view was created
            expect(vscode.window.createTreeView).toHaveBeenCalledWith('wslDistributions', {
                treeDataProvider: mockTreeDataProvider,
                showCollapseAll: true
            });
            // Verify console log
            expect(console.log).toHaveBeenCalledWith('WSL Manager extension is now active!');
        });
        it('should register all required commands', async () => {
            await (0, extension_1.activate)(mockContext);
            const registeredCommands = vscode.commands.registerCommand.mock.calls.map(call => call[0]);
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
            await (0, extension_1.activate)(mockContext);
            // 6 commands + potential configuration watcher
            expect(mockContext.subscriptions.length).toBeGreaterThanOrEqual(6);
            // Verify all items in subscriptions have dispose method
            mockContext.subscriptions.forEach(subscription => {
                expect(subscription).toHaveProperty('dispose');
                expect(typeof subscription.dispose).toBe('function');
            });
        });
        it('should execute auto-refresh on activation', async () => {
            const mockDistributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
            // Mock executeCommand
            vscode.commands.executeCommand.mockResolvedValue(undefined);
            await (0, extension_1.activate)(mockContext);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('wsl-manager.refreshDistributions');
        });
        it('should register configuration change listener when autoRegisterProfiles is true', async () => {
            const mockConfig = {
                get: jest.fn().mockReturnValue(true) // autoRegisterProfiles = true
            };
            vscode.workspace.getConfiguration.mockReturnValue(mockConfig);
            await (0, extension_1.activate)(mockContext);
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
            vscode.workspace.getConfiguration.mockReturnValue(mockConfig);
            await (0, extension_1.activate)(mockContext);
            // Should only have the 6 command subscriptions
            expect(mockContext.subscriptions).toHaveLength(6);
        });
    });
    describe('Command Handlers', () => {
        let commandHandlers = {};
        beforeEach(async () => {
            // Capture command handlers during registration
            vscode.commands.registerCommand.mockImplementation((command, callback) => {
                commandHandlers[command] = callback;
                return { dispose: jest.fn() };
            });
            await (0, extension_1.activate)(mockContext);
        });
        describe('refreshDistributions command', () => {
            it('should refresh tree view and update terminal profiles', async () => {
                const mockDistributions = testDataGenerators_1.distributionGenerators.createDistributionList();
                mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
                await commandHandlers['wsl-manager.refreshDistributions']();
                expect(mockTreeDataProvider.refresh).toHaveBeenCalled();
                expect(mockWSLManager.listDistributions).toHaveBeenCalled();
                expect(mockTerminalProfileManager.updateTerminalProfiles).toHaveBeenCalledWith(mockDistributions);
            });
        });
        describe('createDistribution command', () => {
            it('should create distribution with user input', async () => {
                // Mock user inputs
                vscode.window.showInputBox.mockResolvedValue('test-distro');
                vscode.window.showQuickPick.mockResolvedValue('Ubuntu');
                vscode.window.withProgress.mockImplementation(async (options, task) => {
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
                expect(vscode.window.showQuickPick).toHaveBeenCalledWith(['Ubuntu', 'Debian', 'Alpine', 'openSUSE-Leap'], { placeHolder: 'Select base distribution' });
                expect(mockWSLManager.createDistribution).toHaveBeenCalledWith('test-distro', 'Ubuntu');
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Distribution 'test-distro' created successfully!");
            });
            it('should handle user cancellation', async () => {
                vscode.window.showInputBox.mockResolvedValue(undefined);
                await commandHandlers['wsl-manager.createDistribution']();
                expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
                expect(mockWSLManager.createDistribution).not.toHaveBeenCalled();
            });
            it('should show error message on failure', async () => {
                vscode.window.showInputBox.mockResolvedValue('test-distro');
                vscode.window.showQuickPick.mockResolvedValue('Ubuntu');
                vscode.window.withProgress.mockImplementation(async (options, task) => {
                    const progress = { report: jest.fn() };
                    const token = { isCancellationRequested: false };
                    return await task(progress, token);
                });
                mockWSLManager.createDistribution.mockRejectedValue(new Error('Creation failed'));
                await commandHandlers['wsl-manager.createDistribution']();
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to create distribution: Error: Creation failed');
            });
        });
        describe('openTerminal command', () => {
            it('should create terminal with correct parameters', () => {
                const mockItem = {
                    name: 'Ubuntu',
                    distribution: testDataGenerators_1.distributionGenerators.createDistribution()
                };
                const mockTerminal = {
                    show: jest.fn()
                };
                vscode.window.createTerminal.mockReturnValue(mockTerminal);
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
            vscode.workspace.getConfiguration.mockReturnValue(mockConfig);
            let configChangeHandler = jest.fn();
            vscode.workspace.onDidChangeConfiguration.mockImplementation((handler) => {
                configChangeHandler = handler;
                return { dispose: jest.fn() };
            });
            await (0, extension_1.activate)(mockContext);
            // Simulate configuration change
            const mockDistributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            mockWSLManager.listDistributions.mockResolvedValue(mockDistributions);
            const changeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(true)
            };
            await configChangeHandler(changeEvent);
            expect(changeEvent.affectsConfiguration).toHaveBeenCalledWith('terminal.integrated.profiles.windows');
            expect(mockWSLManager.listDistributions).toHaveBeenCalled();
            expect(mockTerminalProfileManager.updateTerminalProfiles).toHaveBeenCalledWith(mockDistributions);
        });
        it('should not update profiles for unrelated configuration changes', async () => {
            const mockConfig = {
                get: jest.fn().mockReturnValue(true)
            };
            vscode.workspace.getConfiguration.mockReturnValue(mockConfig);
            let configChangeHandler = jest.fn();
            vscode.workspace.onDidChangeConfiguration.mockImplementation((handler) => {
                configChangeHandler = handler;
                return { dispose: jest.fn() };
            });
            await (0, extension_1.activate)(mockContext);
            const changeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(false)
            };
            await configChangeHandler(changeEvent);
            expect(mockWSLManager.listDistributions).not.toHaveBeenCalled();
            expect(mockTerminalProfileManager.updateTerminalProfiles).not.toHaveBeenCalled();
        });
    });
    describe('Extension Deactivation', () => {
        it('should log deactivation message', () => {
            (0, extension_1.deactivate)();
            expect(console.log).toHaveBeenCalledWith('WSL Manager extension is now deactivated');
        });
        it('should be safe to call multiple times', () => {
            (0, extension_1.deactivate)();
            (0, extension_1.deactivate)();
            (0, extension_1.deactivate)();
            expect(console.log).toHaveBeenCalledTimes(3);
        });
    });
    describe('Error Handling', () => {
        it('should handle WSL manager initialization failure gracefully', async () => {
            wslManager_1.WSLManager.mockImplementation(() => {
                throw new Error('WSL not available');
            });
            // Should not throw during activation
            await expect((0, extension_1.activate)(mockContext)).resolves.not.toThrow();
        });
        it('should handle tree view creation failure', async () => {
            vscode.window.createTreeView.mockImplementation(() => {
                throw new Error('Tree view creation failed');
            });
            // Should not throw during activation
            await expect((0, extension_1.activate)(mockContext)).resolves.not.toThrow();
        });
    });
});
//# sourceMappingURL=extension.test.js.map