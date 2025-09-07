import * as vscode from 'vscode';
import { WSLManager } from './wslManager';
import { WSLTreeDataProvider } from './wslTreeDataProvider';
import { WSLTerminalProfileManager } from './terminal/wslTerminalProfileProvider';
import { DistributionRegistry } from './distributionRegistry';
import { DistributionDownloader } from './distributionDownloader';
import { WSLImageManager } from './imageManager';
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
    
    // Initialize new distribution and image managers
    const distributionRegistry = new DistributionRegistry();
    const distributionDownloader = new DistributionDownloader(distributionRegistry);
    const imageManager = new WSLImageManager();

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

        vscode.commands.registerCommand('wsl-manager.downloadDistribution', async () => {
            try {
                // Fetch available distributions from Microsoft
                const availableDistributions = await distributionRegistry.fetchAvailableDistributions();
                
                if (availableDistributions.length === 0) {
                    vscode.window.showWarningMessage('No distributions available. Check your internet connection.');
                    return;
                }

                // Show available distributions for selection
                const distroItems = availableDistributions.map(dist => ({
                    label: dist.FriendlyName,
                    description: dist.Name,
                    detail: `Download and install ${dist.FriendlyName}`
                }));

                const selectedDistro = await vscode.window.showQuickPick(distroItems, {
                    placeHolder: 'Select distribution to download and install'
                });

                if (!selectedDistro) return;

                const distroName = selectedDistro.description!;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Downloading ${selectedDistro.label}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Starting download...' });
                    
                    await distributionDownloader.downloadDistribution(distroName, {
                        onProgress: (downloadProgress) => {
                            progress.report({ 
                                increment: downloadProgress.percent, 
                                message: `${downloadProgress.percent}% complete` 
                            });
                        }
                    });
                });

                await treeDataProvider.refresh();
                const distributions = await wslManager.listDistributions();
                terminalProfileManager?.updateProfiles(distributions);
                vscode.window.showInformationMessage(`Distribution '${selectedDistro.label}' downloaded and installed successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'download distribution');
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

            // Show available images for selection
            try {
                const images = await imageManager.listImages();
                
                if (images.length === 0) {
                    vscode.window.showWarningMessage('No images available. Create an image first or use the download command.');
                    return;
                }

                const imageItems = images.map(img => ({
                    label: img.name,
                    description: img.baseDistribution,
                    detail: img.description || `Based on ${img.baseDistribution}`
                }));

                const selectedImage = await vscode.window.showQuickPick(imageItems, {
                    placeHolder: 'Select image to create distribution from'
                });

                if (!selectedImage) return;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating distribution: ${name}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Creating from image...' });
                    await imageManager.createDistributionFromImage(selectedImage.label, name);
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

        vscode.commands.registerCommand('wsl-manager.createImage', async (item) => {
            // Validate distribution name from tree item
            const nameValidation = InputValidator.validateDistributionName(item.name);
            if (!nameValidation.isValid) {
                vscode.window.showErrorMessage(`Invalid distribution name: ${nameValidation.error}`);
                return;
            }

            const imageName = await vscode.window.showInputBox({
                prompt: 'Enter image name',
                placeHolder: 'my-dev-image',
                validateInput: (value) => {
                    if (!value) return 'Image name is required';
                    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)) {
                        return 'Image name must contain only letters, numbers, hyphens, and underscores';
                    }
                    return undefined;
                }
            });

            if (!imageName) return;

            const description = await vscode.window.showInputBox({
                prompt: 'Enter image description (optional)',
                placeHolder: 'Development environment with Node.js and Python'
            });

            const tags = await vscode.window.showInputBox({
                prompt: 'Enter tags separated by commas (optional)',
                placeHolder: 'development, nodejs, python'
            });

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating image: ${imageName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Exporting distribution...' });
                    
                    const metadata = {
                        description,
                        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [],
                        author: 'VS Code WSL Manager'
                    };
                    
                    await imageManager.createImage(nameValidation.sanitizedValue!, imageName, metadata);
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                vscode.window.showInformationMessage(`Image '${imageName}' created successfully from '${InputValidator.sanitizeForDisplay(item.name)}'!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'create image');
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
