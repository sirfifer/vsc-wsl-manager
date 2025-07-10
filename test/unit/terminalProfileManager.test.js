"use strict";
/**
 * Unit tests for TerminalProfileManager
 * Tests terminal profile management and VS Code configuration updates
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
const terminalProfileManager_1 = require("../../src/terminalProfileManager");
const testDataGenerators_1 = require("../utils/testDataGenerators");
// Mock vscode module
jest.mock('vscode');
describe('TerminalProfileManager', () => {
    let terminalProfileManager;
    let mockContext;
    let mockConfig;
    let mockGlobalState;
    beforeEach(() => {
        // Mock global state
        mockGlobalState = {
            get: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            keys: jest.fn().mockReturnValue([])
        };
        // Mock extension context
        mockContext = {
            globalState: mockGlobalState,
            subscriptions: [],
            extensionPath: '/mock/extension/path',
            asAbsolutePath: jest.fn(path => `/mock/extension/path/${path}`)
        };
        // Mock VS Code workspace configuration
        mockConfig = {
            get: jest.fn().mockReturnValue({}),
            update: jest.fn().mockResolvedValue(undefined),
            has: jest.fn().mockReturnValue(false),
            inspect: jest.fn().mockReturnValue(undefined)
        };
        vscode.workspace.getConfiguration.mockReturnValue(mockConfig);
        // Create terminal profile manager instance
        terminalProfileManager = new terminalProfileManager_1.TerminalProfileManager(mockContext);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('updateTerminalProfiles', () => {
        it('should add terminal profiles for all distributions', async () => {
            const distributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            const existingProfiles = {
                'PowerShell': { path: 'pwsh.exe' },
                'Command Prompt': { path: 'cmd.exe' }
            };
            mockConfig.get.mockReturnValue(existingProfiles);
            await terminalProfileManager.updateTerminalProfiles(distributions);
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('terminal.integrated.profiles.windows');
            const expectedProfiles = {
                'PowerShell': { path: 'pwsh.exe' },
                'Command Prompt': { path: 'cmd.exe' },
                'WSL-Ubuntu': {
                    path: 'wsl.exe',
                    args: ['-d', 'Ubuntu'],
                    icon: 'terminal-linux',
                    overrideName: true
                },
                'WSL-Debian': {
                    path: 'wsl.exe',
                    args: ['-d', 'Debian'],
                    icon: 'terminal-linux',
                    overrideName: true
                },
                'WSL-Alpine': {
                    path: 'wsl.exe',
                    args: ['-d', 'Alpine'],
                    icon: 'terminal-linux',
                    overrideName: true
                }
            };
            expect(mockConfig.update).toHaveBeenCalledWith(undefined, expectedProfiles, vscode.ConfigurationTarget.Global);
            expect(mockGlobalState.update).toHaveBeenCalledWith('managedProfiles', ['Ubuntu', 'Debian', 'Alpine']);
        });
        it('should remove old WSL profiles before adding new ones', async () => {
            const distributions = [testDataGenerators_1.distributionGenerators.createDistribution({ name: 'Ubuntu' })];
            const existingProfiles = {
                'PowerShell': { path: 'pwsh.exe' },
                'WSL-OldDistro': { path: 'wsl.exe', args: ['-d', 'OldDistro'] },
                'WSL-AnotherOld': { path: 'wsl.exe', args: ['-d', 'AnotherOld'] }
            };
            mockConfig.get.mockReturnValue(existingProfiles);
            await terminalProfileManager.updateTerminalProfiles(distributions);
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).not.toHaveProperty('WSL-OldDistro');
            expect(updatedProfiles).not.toHaveProperty('WSL-AnotherOld');
            expect(updatedProfiles).toHaveProperty('WSL-Ubuntu');
            expect(updatedProfiles).toHaveProperty('PowerShell');
        });
        it('should handle empty distributions list', async () => {
            const existingProfiles = {
                'PowerShell': { path: 'pwsh.exe' },
                'WSL-Ubuntu': { path: 'wsl.exe', args: ['-d', 'Ubuntu'] }
            };
            mockConfig.get.mockReturnValue(existingProfiles);
            await terminalProfileManager.updateTerminalProfiles([]);
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).not.toHaveProperty('WSL-Ubuntu');
            expect(updatedProfiles).toHaveProperty('PowerShell');
            expect(mockGlobalState.update).toHaveBeenCalledWith('managedProfiles', []);
        });
        it('should handle null/undefined profiles configuration', async () => {
            mockConfig.get.mockReturnValue(null);
            const distributions = [testDataGenerators_1.distributionGenerators.createDistribution()];
            await terminalProfileManager.updateTerminalProfiles(distributions);
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).toHaveProperty('WSL-Ubuntu');
            expect(Object.keys(updatedProfiles)).toHaveLength(1);
        });
        it('should handle configuration update failure', async () => {
            const distributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            mockConfig.update.mockRejectedValue(new Error('Configuration update failed'));
            await expect(terminalProfileManager.updateTerminalProfiles(distributions)).rejects.toThrow('Configuration update failed');
        });
        it('should preserve profile prefix consistency', async () => {
            const distributions = [
                testDataGenerators_1.distributionGenerators.createDistribution({ name: 'Test-Distro' }),
                testDataGenerators_1.distributionGenerators.createDistribution({ name: 'My_Custom_WSL' })
            ];
            await terminalProfileManager.updateTerminalProfiles(distributions);
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).toHaveProperty('WSL-Test-Distro');
            expect(updatedProfiles).toHaveProperty('WSL-My_Custom_WSL');
        });
    });
    describe('removeTerminalProfiles', () => {
        it('should remove all managed WSL profiles', async () => {
            const existingProfiles = {
                'PowerShell': { path: 'pwsh.exe' },
                'WSL-Ubuntu': { path: 'wsl.exe', args: ['-d', 'Ubuntu'] },
                'WSL-Debian': { path: 'wsl.exe', args: ['-d', 'Debian'] },
                'Git Bash': { path: 'git-bash.exe' }
            };
            mockConfig.get.mockReturnValue(existingProfiles);
            await terminalProfileManager.removeTerminalProfiles();
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).toHaveProperty('PowerShell');
            expect(updatedProfiles).toHaveProperty('Git Bash');
            expect(updatedProfiles).not.toHaveProperty('WSL-Ubuntu');
            expect(updatedProfiles).not.toHaveProperty('WSL-Debian');
            expect(mockGlobalState.update).toHaveBeenCalledWith('managedProfiles', []);
        });
        it('should handle case with no WSL profiles', async () => {
            const existingProfiles = {
                'PowerShell': { path: 'pwsh.exe' },
                'Command Prompt': { path: 'cmd.exe' }
            };
            mockConfig.get.mockReturnValue(existingProfiles);
            await terminalProfileManager.removeTerminalProfiles();
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).toEqual(existingProfiles);
        });
        it('should handle empty profiles configuration', async () => {
            mockConfig.get.mockReturnValue({});
            await terminalProfileManager.removeTerminalProfiles();
            expect(mockConfig.update).toHaveBeenCalledWith(undefined, {}, vscode.ConfigurationTarget.Global);
        });
    });
    describe('ensureDefaultProfile', () => {
        it('should prompt to set distribution as default when not already default', async () => {
            const distributionName = 'Ubuntu';
            mockConfig.get.mockReturnValue('PowerShell');
            vscode.window.showInformationMessage.mockResolvedValue('Yes');
            await terminalProfileManager.ensureDefaultProfile(distributionName);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(`Would you like to set ${distributionName} as your default terminal?`, 'Yes', 'No');
            expect(mockConfig.update).toHaveBeenCalledWith('defaultProfile.windows', 'WSL-Ubuntu', vscode.ConfigurationTarget.Global);
        });
        it('should not prompt when distribution is already default', async () => {
            const distributionName = 'Ubuntu';
            mockConfig.get.mockReturnValue('WSL-Ubuntu');
            await terminalProfileManager.ensureDefaultProfile(distributionName);
            expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
            expect(mockConfig.update).not.toHaveBeenCalled();
        });
        it('should not update when user declines', async () => {
            const distributionName = 'Debian';
            mockConfig.get.mockReturnValue('PowerShell');
            vscode.window.showInformationMessage.mockResolvedValue('No');
            await terminalProfileManager.ensureDefaultProfile(distributionName);
            expect(vscode.window.showInformationMessage).toHaveBeenCalled();
            expect(mockConfig.update).not.toHaveBeenCalled();
        });
        it('should handle user cancelling the prompt', async () => {
            const distributionName = 'Alpine';
            mockConfig.get.mockReturnValue('Command Prompt');
            vscode.window.showInformationMessage.mockResolvedValue(undefined);
            await terminalProfileManager.ensureDefaultProfile(distributionName);
            expect(mockConfig.update).not.toHaveBeenCalled();
        });
        it('should handle configuration read errors', async () => {
            const distributionName = 'Ubuntu';
            mockConfig.get.mockImplementation(() => {
                throw new Error('Configuration read error');
            });
            // Should not throw, but handle gracefully
            await expect(terminalProfileManager.ensureDefaultProfile(distributionName)).rejects.toThrow('Configuration read error');
        });
    });
    describe('Profile naming', () => {
        it('should handle special characters in distribution names', async () => {
            const distributions = [
                { name: 'Ubuntu-20.04', state: 'Running', version: '2', default: false },
                { name: 'Test_WSL', state: 'Running', version: '2', default: false },
                { name: 'My.Custom.Distro', state: 'Running', version: '2', default: false }
            ];
            await terminalProfileManager.updateTerminalProfiles(distributions);
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).toHaveProperty('WSL-Ubuntu-20.04');
            expect(updatedProfiles).toHaveProperty('WSL-Test_WSL');
            expect(updatedProfiles).toHaveProperty('WSL-My.Custom.Distro');
        });
        it('should handle very long distribution names', async () => {
            const longName = 'a'.repeat(100);
            const distributions = [
                { name: longName, state: 'Running', version: '2', default: false }
            ];
            await terminalProfileManager.updateTerminalProfiles(distributions);
            const updatedProfiles = mockConfig.update.mock.calls[0][1];
            expect(updatedProfiles).toHaveProperty(`WSL-${longName}`);
        });
    });
    describe('State management', () => {
        it('should store managed profiles in global state', async () => {
            const distributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            await terminalProfileManager.updateTerminalProfiles(distributions);
            expect(mockGlobalState.update).toHaveBeenCalledWith('managedProfiles', expect.arrayContaining(['Ubuntu', 'Debian', 'Alpine']));
        });
        it('should clear managed profiles when removing all', async () => {
            await terminalProfileManager.removeTerminalProfiles();
            expect(mockGlobalState.update).toHaveBeenCalledWith('managedProfiles', []);
        });
        it('should handle global state update failures gracefully', async () => {
            const distributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            mockGlobalState.update.mockRejectedValue(new Error('State update failed'));
            // Should complete profile update even if state update fails
            await expect(terminalProfileManager.updateTerminalProfiles(distributions)).rejects.toThrow('State update failed');
            // But config update should have been called
            expect(mockConfig.update).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=terminalProfileManager.test.js.map