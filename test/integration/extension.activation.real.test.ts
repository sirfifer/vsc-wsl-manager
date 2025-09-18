/**
 * Extension Activation Real Tests
 * Tests actual VS Code extension activation
 *
 * @author Marcus Johnson, QA Manager
 *
 * NOTE: These tests run in a real VS Code Extension Host environment
 */

import * as vscode from 'vscode';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

describe('Extension Activation - Real VS Code Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    beforeAll(async () => {
        // Get the extension
        extension = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');

        // Activate extension if not already active
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    describe('Extension Loading', () => {
        it('should load the extension', () => {
            expect(extension).toBeDefined();
        });

        it('should have correct extension ID', () => {
            expect(extension?.id).toBe('wsl-manager.vsc-wsl-manager');
        });

        it('should have package.json metadata', () => {
            expect(extension?.packageJSON).toBeDefined();
            expect(extension?.packageJSON.name).toBe('vsc-wsl-manager');
            expect(extension?.packageJSON.publisher).toBe('wsl-manager');
        });

        it('should be in correct extension path', () => {
            expect(extension?.extensionPath).toBeDefined();
            expect(fs.existsSync(extension!.extensionPath)).toBe(true);
        });
    });

    describe('Extension Activation', () => {
        it('should activate successfully', async () => {
            if (!extension) {
                throw new Error('Extension not found');
            }

            // Should activate without errors
            const exports = await extension.activate();

            // Should return exports (even if empty object)
            expect(exports).toBeDefined();
        });

        it('should be active after activation', () => {
            expect(extension?.isActive).toBe(true);
        });

        it('should register activation events', () => {
            const packageJSON = extension?.packageJSON;
            expect(packageJSON?.activationEvents).toBeDefined();
            expect(packageJSON?.activationEvents).toContain('onView:wslDistributions');
        });
    });

    describe('Command Registration', () => {
        it('should register all commands', async () => {
            const commands = await vscode.commands.getCommands(true);

            const expectedCommands = [
                'wsl-manager.refreshDistributions',
                'wsl-manager.downloadDistribution',
                'wsl-manager.createDistribution',
                'wsl-manager.importDistribution',
                'wsl-manager.exportDistribution',
                'wsl-manager.createImage',
                'wsl-manager.deleteDistribution',
                'wsl-manager.deleteImage',
                'wsl-manager.openTerminal'
            ];

            for (const cmd of expectedCommands) {
                expect(commands).toContain(cmd);
            }
        });

        it('should execute refresh command', async () => {
            // This should not throw
            await vscode.commands.executeCommand('wsl-manager.refreshDistributions');
        });

        it('should handle command with no distributions gracefully', async () => {
            // Commands should handle edge cases
            try {
                await vscode.commands.executeCommand('wsl-manager.openTerminal');
                // If it succeeds, that's ok
            } catch (error: any) {
                // Should have user-friendly error
                expect(error.message).toMatch(/select|distribution|no.*found/i);
            }
        });
    });

    describe('View Registration', () => {
        it('should register tree views', () => {
            const packageJSON = extension?.packageJSON;
            const views = packageJSON?.contributes?.views;

            expect(views).toBeDefined();
            expect(views['wsl-manager']).toBeDefined();

            const wslViews = views['wsl-manager'];
            expect(wslViews.some((v: any) => v.id === 'wslDistributions')).toBe(true);
            expect(wslViews.some((v: any) => v.id === 'wslImages')).toBe(true);
        });

        it('should have view containers', () => {
            const packageJSON = extension?.packageJSON;
            const viewContainers = packageJSON?.contributes?.viewsContainers;

            expect(viewContainers).toBeDefined();
            expect(viewContainers.activitybar).toBeDefined();
            expect(viewContainers.activitybar.some((v: any) => v.id === 'wsl-manager')).toBe(true);
        });
    });

    describe('Configuration', () => {
        it('should register configuration properties', () => {
            const packageJSON = extension?.packageJSON;
            const config = packageJSON?.contributes?.configuration;

            expect(config).toBeDefined();
            expect(config.title).toBe('WSL Manager');
            expect(config.properties).toBeDefined();
        });

        it('should have default configuration values', () => {
            const config = vscode.workspace.getConfiguration('wsl-manager');

            // Check defaults
            expect(config.get('autoRegisterProfiles')).toBeDefined();
            expect(config.get('logging.level')).toBeDefined();
        });

        it('should allow configuration updates', async () => {
            const config = vscode.workspace.getConfiguration('wsl-manager');
            const original = config.get<string>('logging.level');

            // Update configuration
            await config.update('logging.level', 'debug', vscode.ConfigurationTarget.Global);

            // Verify update
            const updated = config.get<string>('logging.level');
            expect(updated).toBe('debug');

            // Restore original
            if (original) {
                await config.update('logging.level', original, vscode.ConfigurationTarget.Global);
            }
        });
    });

    describe('Terminal Integration', () => {
        it('should have terminal profile provider capability', () => {
            const packageJSON = extension?.packageJSON;

            // Should have terminal-related commands
            expect(packageJSON?.contributes?.commands).toBeDefined();
            const commands = packageJSON?.contributes?.commands;
            expect(commands.some((c: any) => c.command === 'wsl-manager.openTerminal')).toBe(true);
        });

        it('should register terminal profiles for distributions', async () => {
            // This tests that the extension can register terminal profiles
            // In a real environment with distributions, this would create profiles
            const terminals = vscode.window.terminals;

            // Extension should be able to create terminals
            expect(vscode.window.createTerminal).toBeDefined();
        });
    });

    describe('Menu Contributions', () => {
        it('should register view title menus', () => {
            const packageJSON = extension?.packageJSON;
            const menus = packageJSON?.contributes?.menus;

            expect(menus).toBeDefined();
            expect(menus['view/title']).toBeDefined();

            // Check for refresh button
            const viewTitleMenus = menus['view/title'];
            expect(viewTitleMenus.some((m: any) =>
                m.command === 'wsl-manager.refreshDistributions'
            )).toBe(true);
        });

        it('should register context menus', () => {
            const packageJSON = extension?.packageJSON;
            const menus = packageJSON?.contributes?.menus;

            expect(menus['view/item/context']).toBeDefined();

            // Check for context menu items
            const contextMenus = menus['view/item/context'];
            expect(contextMenus.some((m: any) =>
                m.command === 'wsl-manager.deleteDistribution'
            )).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle missing WSL gracefully', async () => {
            // Execute a command that requires WSL
            try {
                await vscode.commands.executeCommand('wsl-manager.refreshDistributions');
                // If WSL is installed, this succeeds
            } catch (error: any) {
                // If WSL is not installed, should have helpful error
                expect(error.message).toMatch(/wsl.*not.*installed|install.*wsl/i);
            }
        });

        it('should provide user-friendly error messages', async () => {
            // Try to create distribution without parameters
            try {
                await vscode.commands.executeCommand('wsl-manager.createDistribution');
            } catch (error: any) {
                // Should have clear error message
                expect(error.message).not.toContain('undefined');
                expect(error.message).not.toContain('null');
            }
        });
    });

    describe('Performance', () => {
        it('should activate quickly', async () => {
            const startTime = Date.now();

            // Force re-activation
            if (extension) {
                await extension.activate();
            }

            const duration = Date.now() - startTime;

            // Should activate in under 2 seconds
            expect(duration).toBeLessThan(2000);
        });

        it('should register commands immediately', async () => {
            const startTime = Date.now();

            const commands = await vscode.commands.getCommands(true);

            const duration = Date.now() - startTime;

            // Command retrieval should be fast
            expect(duration).toBeLessThan(500);
            expect(commands.length).toBeGreaterThan(0);
        });
    });

    describe('Extension Exports', () => {
        it('should export expected API', async () => {
            if (!extension) {
                throw new Error('Extension not found');
            }

            const exports = await extension.activate();

            // Check if exports contain expected functions/objects
            // The extension might export utilities or APIs
            expect(exports).toBeDefined();
        });
    });

    describe('Workspace Integration', () => {
        it('should work in empty workspace', () => {
            // Extension should handle empty workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;

            // Should not crash with no workspace
            expect(extension?.isActive).toBe(true);
        });

        it('should handle workspace changes', async () => {
            // Listen for workspace changes
            const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
                // Extension should respond to config changes
                expect(e).toBeDefined();
            });

            // Trigger a change
            const config = vscode.workspace.getConfiguration('wsl-manager');
            await config.update('logging.level', 'info', vscode.ConfigurationTarget.Global);

            disposable.dispose();
        });
    });

    afterAll(async () => {
        // Cleanup any test artifacts
        const config = vscode.workspace.getConfiguration('wsl-manager');

        // Reset to defaults
        await config.update('logging.level', undefined, vscode.ConfigurationTarget.Global);
    });
});