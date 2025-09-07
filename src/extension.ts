import * as vscode from 'vscode';
import { WSLManager } from './wslManager';
import { WSLTreeDataProvider } from './wslTreeDataProvider';
import { WSLTerminalProfileManager } from './terminal/wslTerminalProfileProvider';
import { InputValidator } from './utils/inputValidator';
import { ErrorHandler } from './errors/errorHandler';

// Store terminal profile manager for cleanup on deactivation
let terminalProfileManager: WSLTerminalProfileManager | undefined;

/**
 * Activates the WSL Manager extension
 * 
 * @param context - VS Code extension context
 * 
 * @remarks
 * This function is called when the extension is activated.
 * It initializes all managers, registers commands, and sets up the tree view.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('WSL Manager extension is now active!');

    // Initialize managers
    const wslManager = new WSLManager();
    terminalProfileManager = new WSLTerminalProfileManager();
    const treeDataProvider = new WSLTreeDataProvider(wslManager);

    // Register tree view
    const treeView = vscode.window.createTreeView('wslDistributions', {
        treeDataProvider,
        showCollapseAll: true
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('wsl-manager.refreshDistributions', async () => {
            try {
                await treeDataProvider.refresh();
                const distributions = await wslManager.listDistributions();
                terminalProfileManager?.updateProfiles(distributions);
            } catch (error) {
                await ErrorHandler.showError(error, 'refresh distributions');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.createDistribution', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter distribution name',
                placeHolder: 'my-custom-wsl',
                validateInput: (value) => {
                    if (!value) return 'Distribution name is required';
                    const validation = InputValidator.validateDistributionName(value);
                    return validation.isValid ? undefined : validation.error;
                }
            });

            if (!name) return;

            const baseDistros = ['Ubuntu', 'Debian', 'Alpine', 'openSUSE-Leap'];
            const baseDistro = await vscode.window.showQuickPick(baseDistros, {
                placeHolder: 'Select base distribution'
            });

            if (!baseDistro) return;

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating WSL distribution: ${name}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Downloading base image...' });
                    await wslManager.createDistribution(name, baseDistro);
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await treeDataProvider.refresh();
                const distributions = await wslManager.listDistributions();
                terminalProfileManager?.updateProfiles(distributions);
                vscode.window.showInformationMessage(`Distribution '${name}' created successfully!`);
            } catch (error) {
                await ErrorHandler.showError(error, 'create distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.importDistribution', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter distribution name',
                placeHolder: 'imported-wsl',
                validateInput: (value) => {
                    if (!value) return 'Distribution name is required';
                    const validation = InputValidator.validateDistributionName(value);
                    return validation.isValid ? undefined : validation.error;
                }
            });

            if (!name) return;

            const tarFile = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'TAR files': ['tar']
                }
            });

            if (!tarFile || tarFile.length === 0) return;

            const installLocation = await vscode.window.showInputBox({
                prompt: 'Enter installation path (or leave empty for default)',
                placeHolder: 'C:\\WSL\\imported-wsl',
                validateInput: (value) => {
                    if (!value) return undefined; // Empty is allowed for default
                    const validation = InputValidator.validateDirectoryPath(value);
                    return validation.isValid ? undefined : validation.error;
                }
            });

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Importing WSL distribution: ${name}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Importing...' });
                    await wslManager.importDistribution(name, tarFile[0].fsPath, installLocation);
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await treeDataProvider.refresh();
                const distributions = await wslManager.listDistributions();
                terminalProfileManager?.updateProfiles(distributions);
                vscode.window.showInformationMessage(`Distribution '${name}' imported successfully!`);
            } catch (error) {
                await ErrorHandler.showError(error, 'import distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.exportDistribution', async (item) => {
            // Validate distribution name from tree item
            const nameValidation = InputValidator.validateDistributionName(item.name);
            if (!nameValidation.isValid) {
                vscode.window.showErrorMessage(`Invalid distribution name: ${nameValidation.error}`);
                return;
            }

            const saveLocation = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${nameValidation.sanitizedValue}.tar`),
                filters: {
                    'TAR files': ['tar']
                }
            });

            if (!saveLocation) return;

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Exporting WSL distribution: ${nameValidation.sanitizedValue}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Exporting...' });
                    await wslManager.exportDistribution(nameValidation.sanitizedValue!, saveLocation.fsPath);
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                vscode.window.showInformationMessage(`Distribution '${nameValidation.sanitizedValue}' exported successfully!`);
            } catch (error) {
                await ErrorHandler.showError(error, 'export distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.deleteDistribution', async (item) => {
            // Validate distribution name from tree item
            const nameValidation = InputValidator.validateDistributionName(item.name);
            if (!nameValidation.isValid) {
                vscode.window.showErrorMessage(`Invalid distribution name: ${nameValidation.error}`);
                return;
            }

            const displayName = InputValidator.sanitizeForDisplay(item.name);
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the distribution '${displayName}'? This action cannot be undone.`,
                'Yes', 'No'
            );

            if (confirm !== 'Yes') return;

            try {
                await wslManager.unregisterDistribution(nameValidation.sanitizedValue!);
                await treeDataProvider.refresh();
                const distributions = await wslManager.listDistributions();
                terminalProfileManager?.updateProfiles(distributions);
                vscode.window.showInformationMessage(`Distribution '${displayName}' deleted successfully!`);
            } catch (error) {
                await ErrorHandler.showError(error, 'delete distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.openTerminal', (item) => {
            // Validate distribution name from tree item
            const nameValidation = InputValidator.validateDistributionName(item.name);
            if (!nameValidation.isValid) {
                vscode.window.showErrorMessage(`Invalid distribution name: ${nameValidation.error}`);
                return;
            }

            const displayName = InputValidator.sanitizeForDisplay(item.name);
            const terminal = vscode.window.createTerminal({
                name: `WSL: ${displayName}`,
                shellPath: 'wsl.exe',
                shellArgs: ['-d', nameValidation.sanitizedValue!]
            });
            terminal.show();
        })
    );

    // Auto-refresh on activation
    vscode.commands.executeCommand('wsl-manager.refreshDistributions');
    
    // Register terminal profiles for all distributions
    wslManager.listDistributions().then(distributions => {
        terminalProfileManager?.registerProfiles(distributions);
    }).catch(error => {
        console.error('Failed to register terminal profiles:', error);
    });

    // No need to watch terminal profile changes anymore since we use the Provider API
    // The terminal profiles are managed by VS Code, not by modifying settings
}

/**
 * Deactivates the WSL Manager extension
 * 
 * @remarks
 * This function is called when the extension is deactivated.
 * Cleanup is handled automatically by VS Code disposing subscriptions.
 */
export function deactivate() {
    try {
        console.log('WSL Manager extension is now deactivated');
        
        // Dispose terminal profile providers
        if (terminalProfileManager) {
            terminalProfileManager.dispose();
            terminalProfileManager = undefined;
        }
        
        // Other cleanup will be handled by VS Code disposing subscriptions
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}
