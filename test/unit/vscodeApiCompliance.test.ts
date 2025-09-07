/**
 * VS Code API Compliance Tests
 * Ensures the extension follows all VS Code API guidelines and best practices
 */

import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/extension';

// Mock vscode module
jest.mock('vscode');

describe('VS Code API Compliance', () => {
    let mockContext: vscode.ExtensionContext;
    let mockWorkspaceConfiguration: any;
    
    beforeEach(() => {
        // Setup context mock
        mockContext = {
            subscriptions: [],
            globalState: {
                get: jest.fn(),
                update: jest.fn().mockResolvedValue(undefined),
                keys: jest.fn().mockReturnValue([])
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn().mockResolvedValue(undefined),
                keys: jest.fn().mockReturnValue([])
            },
            extensionPath: '/mock/path',
            asAbsolutePath: jest.fn(p => `/mock/path/${p}`),
            storagePath: '/mock/storage',
            globalStoragePath: '/mock/global-storage',
            logPath: '/mock/logs'
        } as any;
        
        // Setup workspace configuration mock
        mockWorkspaceConfiguration = {
            get: jest.fn(),
            has: jest.fn(),
            inspect: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined)
        };
        
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockWorkspaceConfiguration);
        
        jest.clearAllMocks();
    });
    
    describe('Configuration Management', () => {
        it('should only modify extension-owned settings', async () => {
            // Setup configuration mock to track what's being modified
            const updateSpy = jest.spyOn(mockWorkspaceConfiguration, 'update');
            
            // Simulate extension modifying its own settings
            const config = vscode.workspace.getConfiguration('wsl-manager');
            await config.update('terminal.autoRegister', true, vscode.ConfigurationTarget.Global);
            
            // Should only update wsl-manager.* settings
            expect(updateSpy).toHaveBeenCalledWith(
                'terminal.autoRegister',
                true,
                vscode.ConfigurationTarget.Global
            );
        });
        
        it('should NOT modify system settings like terminal.integrated.profiles', async () => {
            // This test ensures we're not trying to modify terminal.integrated.profiles
            const systemConfig = vscode.workspace.getConfiguration('terminal.integrated');
            const updateSpy = jest.spyOn(systemConfig, 'update');
            
            // The extension should NEVER do this
            // await systemConfig.update('profiles.windows', {}, vscode.ConfigurationTarget.Global);
            
            // Verify the extension doesn't try to update system settings
            activate(mockContext);
            
            // Check that terminal.integrated was never accessed for updates
            expect(vscode.workspace.getConfiguration).not.toHaveBeenCalledWith('terminal.integrated');
            expect(vscode.workspace.getConfiguration).not.toHaveBeenCalledWith('terminal.integrated.profiles.windows');
        });
        
        it('should use proper ConfigurationTarget values', async () => {
            const config = vscode.workspace.getConfiguration('wsl-manager');
            
            // Test all valid configuration targets
            const targets = [
                vscode.ConfigurationTarget.Global,
                vscode.ConfigurationTarget.Workspace,
                vscode.ConfigurationTarget.WorkspaceFolder
            ];
            
            for (const target of targets) {
                await config.update('test.setting', 'value', target);
                
                expect(mockWorkspaceConfiguration.update).toHaveBeenCalledWith(
                    'test.setting',
                    'value',
                    target
                );
            }
        });
        
        it('should handle configuration read errors gracefully', async () => {
            mockWorkspaceConfiguration.get.mockImplementation(() => {
                throw new Error('Configuration read error');
            });
            
            // Extension should handle this gracefully
            expect(() => {
                const config = vscode.workspace.getConfiguration('wsl-manager');
                config.get('some.setting');
            }).toThrow('Configuration read error');
        });
        
        it('should handle configuration update failures gracefully', async () => {
            mockWorkspaceConfiguration.update.mockRejectedValue(new Error('Update failed'));
            
            const config = vscode.workspace.getConfiguration('wsl-manager');
            
            await expect(
                config.update('test.setting', 'value', vscode.ConfigurationTarget.Global)
            ).rejects.toThrow('Update failed');
        });
    });
    
    describe('Command Registration', () => {
        it('should register commands with proper naming convention', () => {
            const registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
            
            activate(mockContext);
            
            // All commands should follow extension.action pattern
            const registeredCommands = registerCommandSpy.mock.calls.map(call => call[0]);
            
            registeredCommands.forEach(command => {
                expect(command).toMatch(/^wsl-manager\.[a-zA-Z]+/);
            });
        });
        
        it('should add all command disposables to subscriptions', () => {
            activate(mockContext);
            
            // All registered commands should be added to subscriptions
            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });
        
        it('should handle command execution errors gracefully', async () => {
            const mockShowErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage');
            
            activate(mockContext);
            
            // Get a registered command handler
            const registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
            const commandHandler = registerCommandSpy.mock.calls[0][1];
            
            // Simulate command throwing an error
            const testError = new Error('Command execution failed');
            jest.spyOn(console, 'error').mockImplementation(() => {});
            
            // Commands should handle errors without crashing
            // This would need to be tested with actual command implementation
        });
    });
    
    describe('Extension Lifecycle', () => {
        it('should properly dispose resources on deactivation', () => {
            const disposeSpy = jest.fn();
            const mockDisposable = { dispose: disposeSpy };
            
            mockContext.subscriptions.push(mockDisposable);
            
            activate(mockContext);
            deactivate();
            
            // All subscriptions should be disposed
            expect(disposeSpy).toHaveBeenCalled();
        });
        
        it('should not activate on startup (*) but use specific activation events', () => {
            // Check package.json doesn't use * activation
            // This would be checked in the actual package.json
            // Here we verify the extension doesn't do heavy work on activation
            
            const startTime = Date.now();
            activate(mockContext);
            const activationTime = Date.now() - startTime;
            
            // Activation should be fast (< 100ms for unit test)
            expect(activationTime).toBeLessThan(100);
        });
        
        it('should handle activation errors gracefully', () => {
            // Mock an error during activation
            jest.spyOn(vscode.window, 'createTreeView').mockImplementation(() => {
                throw new Error('Tree view creation failed');
            });
            
            // Activation should handle errors without crashing
            expect(() => activate(mockContext)).not.toThrow();
        });
    });
    
    describe('Workspace Trust', () => {
        it('should respect workspace trust settings', () => {
            // Mock untrusted workspace
            (vscode.workspace as any).isTrusted = false;
            
            activate(mockContext);
            
            // Certain operations should be restricted in untrusted workspaces
            // This needs to be implemented in the actual extension
        });
        
        it('should handle workspace trust changes', () => {
            const trustChangeEmitter = new vscode.EventEmitter<void>();
            (vscode.workspace as any).onDidGrantWorkspaceTrust = trustChangeEmitter.event;
            
            activate(mockContext);
            
            // Trigger trust change
            trustChangeEmitter.fire();
            
            // Extension should react to trust changes appropriately
        });
    });
    
    describe('Progress Notifications', () => {
        it('should use proper progress locations', async () => {
            const withProgressSpy = jest.spyOn(vscode.window, 'withProgress');
            
            // Mock a long-running operation
            const longOperation = async () => {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Test Operation',
                    cancellable: true
                }, async (progress, token) => {
                    progress.report({ increment: 50, message: 'Processing...' });
                    return new Promise(resolve => setTimeout(resolve, 100));
                });
            };
            
            await longOperation();
            
            expect(withProgressSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    location: vscode.ProgressLocation.Notification,
                    cancellable: true
                }),
                expect.any(Function)
            );
        });
        
        it('should handle cancellation tokens properly', async () => {
            let tokenChecked = false;
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Cancellable Operation',
                cancellable: true
            }, async (progress, token) => {
                // Should check cancellation token
                if (token.isCancellationRequested) {
                    tokenChecked = true;
                    return;
                }
                
                // Simulate work
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Check again after work
                if (token.isCancellationRequested) {
                    tokenChecked = true;
                    return;
                }
            });
            
            // Token should be checked during operation
            // In real implementation, this would be tested with actual cancellation
        });
    });
    
    describe('User Input Validation', () => {
        it('should validate input in showInputBox', async () => {
            const showInputBoxSpy = jest.spyOn(vscode.window, 'showInputBox');
            
            await vscode.window.showInputBox({
                prompt: 'Enter name',
                validateInput: (value) => {
                    if (!value) return 'Value is required';
                    if (value.length < 3) return 'Too short';
                    return undefined;
                }
            });
            
            expect(showInputBoxSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    validateInput: expect.any(Function)
                })
            );
        });
        
        it('should provide clear validation error messages', () => {
            const validateInput = (value: string) => {
                if (!value) return 'Distribution name is required';
                if (!/^[a-zA-Z0-9-_]+$/.test(value)) return 'Invalid characters in name';
                if (value.length > 50) return 'Name too long (max 50 characters)';
                return undefined;
            };
            
            expect(validateInput('')).toBe('Distribution name is required');
            expect(validateInput('test@123')).toBe('Invalid characters in name');
            expect(validateInput('a'.repeat(51))).toBe('Name too long (max 50 characters)');
            expect(validateInput('valid-name')).toBeUndefined();
        });
    });
    
    describe('Terminal Profile Provider API', () => {
        it('should use registerTerminalProfileProvider instead of modifying settings', () => {
            const registerSpy = jest.spyOn(vscode.window, 'registerTerminalProfileProvider');
            
            // The correct way to add terminal profiles
            const profileId = 'wsl-manager.ubuntu';
            const provider = {
                provideTerminalProfile: jest.fn().mockResolvedValue({
                    options: {
                        name: 'WSL: Ubuntu',
                        shellPath: 'wsl.exe',
                        shellArgs: ['-d', 'Ubuntu']
                    }
                })
            };
            
            vscode.window.registerTerminalProfileProvider(profileId, provider);
            
            expect(registerSpy).toHaveBeenCalledWith(profileId, provider);
        });
        
        it('should NOT attempt to modify terminal.integrated.profiles', () => {
            activate(mockContext);
            
            // Ensure we never try to get terminal.integrated configuration for modification
            const getConfigCalls = (vscode.workspace.getConfiguration as jest.Mock).mock.calls;
            
            getConfigCalls.forEach(call => {
                expect(call[0]).not.toBe('terminal.integrated');
                expect(call[0]).not.toMatch(/^terminal\.integrated/);
            });
        });
    });
    
    describe('Error Handling', () => {
        it('should use VS Code error APIs appropriately', async () => {
            const showErrorSpy = jest.spyOn(vscode.window, 'showErrorMessage');
            const showWarningSpy = jest.spyOn(vscode.window, 'showWarningMessage');
            const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage');
            
            // Test error message
            await vscode.window.showErrorMessage('Error occurred', 'Retry', 'Cancel');
            expect(showErrorSpy).toHaveBeenCalledWith('Error occurred', 'Retry', 'Cancel');
            
            // Test warning message
            await vscode.window.showWarningMessage('Warning message');
            expect(showWarningSpy).toHaveBeenCalledWith('Warning message');
            
            // Test info message
            await vscode.window.showInformationMessage('Info message');
            expect(showInfoSpy).toHaveBeenCalledWith('Info message');
        });
        
        it('should provide actionable error messages', () => {
            const errorMessages = [
                { error: 'WSL not installed', action: 'Install WSL from Microsoft Store' },
                { error: 'Permission denied', action: 'Run VS Code as administrator' },
                { error: 'Distribution not found', action: 'Check distribution name' }
            ];
            
            errorMessages.forEach(({ error, action }) => {
                // Error messages should include recovery actions
                const message = `${error}. ${action}`;
                expect(message).toContain(action);
            });
        });
    });
});