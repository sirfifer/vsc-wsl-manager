"use strict";
/**
 * Integration tests for command workflows
 * Tests complete command execution flows with all components
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
const testDataGenerators_1 = require("../utils/testDataGenerators");
const systemCommands_1 = require("../mocks/systemCommands");
// Mock modules
jest.mock('vscode');
jest.mock('child_process', () => ({
    exec: systemCommands_1.mockExec
}));
jest.mock('util', () => ({
    promisify: (fn) => fn
}));
jest.mock('fs', () => systemCommands_1.mockFs);
describe('Command Integration Tests', () => {
    let mockContext;
    let commandHandlers = {};
    beforeEach(async () => {
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
            extensionPath: '/mock/extension/path'
        };
        // Mock VS Code APIs
        vscode.window.createTreeView.mockReturnValue({
            visible: true,
            reveal: jest.fn(),
            dispose: jest.fn()
        });
        vscode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue(true),
            update: jest.fn().mockResolvedValue(undefined)
        });
        // Capture command handlers
        vscode.commands.registerCommand.mockImplementation((command, callback) => {
            commandHandlers[command] = callback;
            return { dispose: jest.fn() };
        });
        vscode.window.withProgress.mockImplementation(async (options, task) => {
            const progress = { report: jest.fn() };
            const token = { isCancellationRequested: false };
            return await task(progress, token);
        });
        // Set up default WSL list response
        systemCommands_1.commandMockUtils.setupExecMock('--list --verbose', testDataGenerators_1.distributionGenerators.createRawWSLOutput());
        // Activate extension
        await (0, extension_1.activate)(mockContext);
    });
    describe('Import Distribution Workflow', () => {
        it('should complete full import workflow successfully', async () => {
            const distributionName = 'imported-ubuntu';
            const tarPath = testDataGenerators_1.pathGenerators.createPath('tar');
            const installPath = testDataGenerators_1.pathGenerators.createPath('dir');
            // Mock user inputs
            vscode.window.showInputBox
                .mockResolvedValueOnce(distributionName)
                .mockResolvedValueOnce(installPath);
            vscode.window.showOpenDialog.mockResolvedValue([{ fsPath: tarPath }]);
            // Mock successful import
            systemCommands_1.commandMockUtils.setupExecMock('--import', 'Import successful');
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
            expect(systemCommands_1.mockFs.promises.mkdir).toHaveBeenCalledWith(installPath, { recursive: true });
            // Verify import command
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(`--import "${distributionName}" "${installPath}" "${tarPath}"`), expect.any(Function));
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(`Distribution '${distributionName}' imported successfully!`);
        });
        it('should handle import cancellation at each step', async () => {
            // Test cancellation at name input
            vscode.window.showInputBox.mockResolvedValueOnce(undefined);
            await commandHandlers['wsl-manager.importDistribution']();
            expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
            expect(systemCommands_1.mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--import'), expect.any(Function));
            // Test cancellation at file selection
            jest.clearAllMocks();
            vscode.window.showInputBox.mockResolvedValueOnce('test-name');
            vscode.window.showOpenDialog.mockResolvedValue(undefined);
            await commandHandlers['wsl-manager.importDistribution']();
            expect(systemCommands_1.mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--import'), expect.any(Function));
        });
        it('should show error on import failure', async () => {
            vscode.window.showInputBox
                .mockResolvedValueOnce('test-distro')
                .mockResolvedValueOnce('');
            vscode.window.showOpenDialog.mockResolvedValue([{ fsPath: '/test.tar' }]);
            systemCommands_1.commandMockUtils.setupExecMock('--import', '', 'Import failed: Invalid TAR file');
            await commandHandlers['wsl-manager.importDistribution']();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to import distribution'));
        });
    });
    describe('Export Distribution Workflow', () => {
        it('should complete full export workflow successfully', async () => {
            const distribution = testDataGenerators_1.distributionGenerators.createDistribution({ name: 'Ubuntu' });
            const exportPath = testDataGenerators_1.pathGenerators.createPath('tar');
            // Mock save dialog
            vscode.window.showSaveDialog.mockResolvedValue({ fsPath: exportPath });
            // Mock successful export
            systemCommands_1.commandMockUtils.setupExecMock('--export', 'Export successful');
            // Execute command with distribution item
            await commandHandlers['wsl-manager.exportDistribution'](distribution);
            // Verify save dialog
            expect(vscode.window.showSaveDialog).toHaveBeenCalledWith({
                defaultUri: expect.objectContaining({ path: `${distribution.name}.tar` }),
                filters: { 'TAR files': ['tar'] }
            });
            // Verify export command
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe --export "${distribution.name}" "${exportPath}"`, expect.any(Function));
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(`Distribution '${distribution.name}' exported successfully!`);
        });
        it('should handle export cancellation', async () => {
            const distribution = testDataGenerators_1.distributionGenerators.createDistribution();
            vscode.window.showSaveDialog.mockResolvedValue(undefined);
            await commandHandlers['wsl-manager.exportDistribution'](distribution);
            expect(systemCommands_1.mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--export'), expect.any(Function));
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
    });
    describe('Delete Distribution Workflow', () => {
        it('should delete distribution after confirmation', async () => {
            const distribution = testDataGenerators_1.distributionGenerators.createDistribution({ name: 'TestDistro' });
            // Mock confirmation dialog
            vscode.window.showWarningMessage.mockResolvedValue('Yes');
            // Mock successful deletion
            systemCommands_1.commandMockUtils.setupExecMock('--unregister', 'Unregister successful');
            // Execute command
            await commandHandlers['wsl-manager.deleteDistribution'](distribution);
            // Verify confirmation prompt
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(`Are you sure you want to delete the distribution '${distribution.name}'? This action cannot be undone.`, 'Yes', 'No');
            // Verify unregister command
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe --unregister "${distribution.name}"`, expect.any(Function));
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(`Distribution '${distribution.name}' deleted successfully!`);
        });
        it('should not delete when user cancels confirmation', async () => {
            const distribution = testDataGenerators_1.distributionGenerators.createDistribution();
            vscode.window.showWarningMessage.mockResolvedValue('No');
            await commandHandlers['wsl-manager.deleteDistribution'](distribution);
            expect(systemCommands_1.mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--unregister'), expect.any(Function));
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
        });
        it('should handle undefined confirmation response', async () => {
            const distribution = testDataGenerators_1.distributionGenerators.createDistribution();
            vscode.window.showWarningMessage.mockResolvedValue(undefined);
            await commandHandlers['wsl-manager.deleteDistribution'](distribution);
            expect(systemCommands_1.mockExec).not.toHaveBeenCalledWith(expect.stringContaining('--unregister'), expect.any(Function));
        });
    });
    describe('Create Distribution Workflow', () => {
        it('should complete full creation workflow', async () => {
            const newName = 'my-dev-env';
            const baseDistro = 'Ubuntu';
            // Mock user inputs
            vscode.window.showInputBox.mockResolvedValue(newName);
            vscode.window.showQuickPick.mockResolvedValue(baseDistro);
            // Mock successful creation
            systemCommands_1.commandMockUtils.setupExecMock('--export', 'Export successful');
            systemCommands_1.commandMockUtils.setupExecMock('--import', 'Import successful');
            // Execute command
            await commandHandlers['wsl-manager.createDistribution']();
            // Verify prompts
            expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                prompt: 'Enter distribution name',
                placeHolder: 'my-custom-wsl'
            });
            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(['Ubuntu', 'Debian', 'Alpine', 'openSUSE-Leap'], { placeHolder: 'Select base distribution' });
            // Verify progress notification
            expect(vscode.window.withProgress).toHaveBeenCalledWith({
                location: vscode.ProgressLocation.Notification,
                title: `Creating WSL distribution: ${newName}`,
                cancellable: false
            }, expect.any(Function));
            // Verify export and import commands were called
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(`--export "${baseDistro}"`), expect.any(Function));
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(`--import "${newName}"`), expect.any(Function));
            // Verify temp file cleanup
            expect(systemCommands_1.mockFs.promises.unlink).toHaveBeenCalled();
            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(`Distribution '${newName}' created successfully!`);
        });
        it('should validate base distribution exists', async () => {
            const newName = 'test-distro';
            const baseDistro = 'NonExistent';
            vscode.window.showInputBox.mockResolvedValue(newName);
            vscode.window.showQuickPick.mockResolvedValue(baseDistro);
            // Mock distributions list without the base distro
            systemCommands_1.commandMockUtils.setupExecMock('--list --verbose', testDataGenerators_1.distributionGenerators.createRawWSLOutput([
                testDataGenerators_1.distributionGenerators.createDistribution({ name: 'Ubuntu' })
            ]));
            await commandHandlers['wsl-manager.createDistribution']();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining(`Base distribution '${baseDistro}' is not installed`));
        });
    });
    describe('Refresh Distributions Workflow', () => {
        it('should refresh all components', async () => {
            const mockDistributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            systemCommands_1.commandMockUtils.setupExecMock('--list --verbose', testDataGenerators_1.distributionGenerators.createRawWSLOutput(mockDistributions));
            // Clear previous calls from activation
            jest.clearAllMocks();
            await commandHandlers['wsl-manager.refreshDistributions']();
            // Verify WSL list was called
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith('wsl.exe --list --verbose', expect.any(Function));
            // Tree refresh and terminal profile update should have been called
            // (These are verified in the mock implementations)
        });
        it('should handle refresh errors gracefully', async () => {
            systemCommands_1.commandMockUtils.setupExecMock('--list', '', 'WSL not found');
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
                        vscode.window.showInputBox.mockResolvedValue('test');
                        vscode.window.showQuickPick.mockResolvedValue('Ubuntu');
                        systemCommands_1.commandMockUtils.setupExecMock('--export', '', 'Access denied');
                    },
                    expectedError: 'Failed to create distribution'
                },
                {
                    command: 'wsl-manager.importDistribution',
                    setup: () => {
                        vscode.window.showInputBox.mockResolvedValue('test');
                        vscode.window.showOpenDialog.mockResolvedValue([{ fsPath: '/test.tar' }]);
                        systemCommands_1.commandMockUtils.setupExecMock('--import', '', 'Disk full');
                    },
                    expectedError: 'Failed to import distribution'
                },
                {
                    command: 'wsl-manager.exportDistribution',
                    setup: () => {
                        vscode.window.showSaveDialog.mockResolvedValue({ fsPath: '/test.tar' });
                        systemCommands_1.commandMockUtils.setupExecMock('--export', '', 'Distribution not found');
                    },
                    expectedError: 'Failed to export distribution'
                }
            ];
            for (const scenario of scenarios) {
                jest.clearAllMocks();
                scenario.setup();
                const item = testDataGenerators_1.distributionGenerators.createDistribution();
                await commandHandlers[scenario.command](item);
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining(scenario.expectedError));
            }
        });
    });
    describe('Progress Reporting', () => {
        it('should report progress during long operations', async () => {
            let progressReporter;
            vscode.window.withProgress.mockImplementation(async (options, task) => {
                progressReporter = { report: jest.fn() };
                const token = { isCancellationRequested: false };
                return await task(progressReporter, token);
            });
            vscode.window.showInputBox.mockResolvedValue('test');
            vscode.window.showQuickPick.mockResolvedValue('Ubuntu');
            systemCommands_1.commandMockUtils.setupExecMock('--export', 'Success');
            systemCommands_1.commandMockUtils.setupExecMock('--import', 'Success');
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
//# sourceMappingURL=commands.test.js.map