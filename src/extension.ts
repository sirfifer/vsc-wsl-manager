import * as vscode from 'vscode';
import { WSLManager } from './wslManager';
import { WSLImageTreeDataProvider } from './wslImageTreeDataProvider';
import { WSLDistributionTreeDataProvider } from './wslDistributionTreeDataProvider';
import { WSLTerminalProfileManager } from './terminal/wslTerminalProfileProvider';
import { DistributionRegistry } from './distributionRegistry';
import { DistributionDownloader } from './distributionDownloader';
import { WSLImageManager, ImageInfo } from './imageManager';
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
 * It initializes all managers, registers commands, and sets up the two tree views.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('WSL Manager extension is now active!');

    // Initialize managers
    const wslManager = new WSLManager();
    terminalProfileManager = new WSLTerminalProfileManager();
    
    // Initialize distribution and image managers
    const distributionRegistry = new DistributionRegistry();
    const distributionDownloader = new DistributionDownloader(distributionRegistry);
    const imageManager = new WSLImageManager();
    
    // Create separate tree data providers
    const imageTreeProvider = new WSLImageTreeDataProvider(imageManager);
    const distributionTreeProvider = new WSLDistributionTreeDataProvider(wslManager);

    // Register two separate tree views
    const imageView = vscode.window.createTreeView('wslImages', {
        treeDataProvider: imageTreeProvider,
        showCollapseAll: true
    });
    
    const distributionView = vscode.window.createTreeView('wslDistributions', {
        treeDataProvider: distributionTreeProvider,
        showCollapseAll: true
    });

    // Helper function to refresh both views and terminal profiles
    async function refreshAll() {
        imageTreeProvider.refresh();
        distributionTreeProvider.refresh();
        
        const distributions = await wslManager.listDistributions();
        const images = await imageManager.listImages();
        terminalProfileManager?.updateProfiles(distributions, images);
    }

    // Register commands
    context.subscriptions.push(
        // Images view commands
        vscode.commands.registerCommand('wsl-manager.refreshImages', async () => {
            try {
                await refreshAll();
            } catch (error) {
                await ErrorHandler.showError(error, 'refresh images');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.createImageFromDistribution', async () => {
            try {
                const distributions = await wslManager.listDistributions();
                
                if (distributions.length === 0) {
                    vscode.window.showWarningMessage('No WSL distributions found. Download or create a distribution first.');
                    return;
                }

                const distroItems = distributions.map(dist => ({
                    label: dist.name,
                    description: dist.default ? '(default)' : '',
                    distribution: dist
                }));

                const selectedDistro = await vscode.window.showQuickPick(distroItems, {
                    placeHolder: 'Select distribution to create image from'
                });

                if (!selectedDistro) return;

                const nameValidation = InputValidator.validateDistributionName(selectedDistro.distribution.name);
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

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating image: ${imageName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Exporting distribution...' });
                    
                    const metadata = {
                        description,
                        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [],
                        author: 'VS Code WSL Manager',
                        enabled: true // Default to enabled
                    };
                    
                    await imageManager.createImage(nameValidation.sanitizedValue!, imageName, metadata);
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Image '${imageName}' created successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'create image from distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.createImageFromImage', async () => {
            try {
                const images = await imageManager.listImages();
                
                if (images.length === 0) {
                    vscode.window.showWarningMessage('No images available. Create an image from a distribution first.');
                    return;
                }

                const imageItems = images.map(img => ({
                    label: img.name,
                    description: img.description,
                    detail: `Base: ${img.baseDistribution || img.baseImage}`,
                    image: img
                }));

                const sourceImage = await vscode.window.showQuickPick(imageItems, {
                    placeHolder: 'Select source image to create from'
                });

                if (!sourceImage) return;

                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter name for new image',
                    value: `${sourceImage.image.name}-copy`,
                    validateInput: (value) => {
                        if (!value) return 'Name is required';
                        if (images.some(img => img.name === value)) {
                            return 'An image with this name already exists';
                        }
                        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)) {
                            return 'Image name must contain only letters, numbers, hyphens, and underscores';
                        }
                        return undefined;
                    }
                });

                if (!newName) return;

                const description = await vscode.window.showInputBox({
                    prompt: 'Enter description for new image (optional)',
                    placeHolder: 'Modified version of ' + sourceImage.image.name
                });

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating image: ${newName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Cloning image...' });
                    
                    await imageManager.createImageFromImage(sourceImage.image.name, newName, {
                        description,
                        enabled: true // Default to enabled
                    });
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Image '${newName}' created from '${sourceImage.image.name}'!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'create image from image');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.editImageProperties', async (item) => {
            try {
                const imageName = item?.image?.name;
                if (!imageName) {
                    // If not called from tree item, show picker
                    const images = await imageManager.listImages();
                    const selected = await vscode.window.showQuickPick(
                        images.map(img => ({
                            label: img.name,
                            description: img.enabled ? 'Enabled' : 'Disabled',
                            image: img
                        })),
                        { placeHolder: 'Select image to edit' }
                    );
                    if (!selected) return;
                    item = { image: selected.image };
                }

                const image = item.image as ImageInfo;

                const newName = await vscode.window.showInputBox({
                    prompt: 'Image name (press Enter to keep current)',
                    value: image.name,
                    validateInput: (value) => {
                        if (!value) return 'Name is required';
                        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)) {
                            return 'Image name must contain only letters, numbers, hyphens, and underscores';
                        }
                        return undefined;
                    }
                });

                if (!newName) return;

                const newDescription = await vscode.window.showInputBox({
                    prompt: 'Description (press Enter to keep current)',
                    value: image.description || '',
                    placeHolder: 'Description of the image'
                });

                const enabledChoice = await vscode.window.showQuickPick(
                    [
                        { label: 'Enabled', description: 'Image appears in terminal profiles', value: true },
                        { label: 'Disabled', description: 'Image hidden from terminal profiles', value: false }
                    ],
                    {
                        placeHolder: 'Enable or disable image'
                    }
                );

                if (!enabledChoice) return;

                await imageManager.updateImageProperties(image.name, {
                    name: newName,
                    description: newDescription,
                    enabled: enabledChoice.value
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Image '${newName}' properties updated!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'edit image properties');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.toggleImageEnabled', async (item) => {
            try {
                const imageName = item?.image?.name;
                if (!imageName) {
                    const images = await imageManager.listImages();
                    const selected = await vscode.window.showQuickPick(
                        images.map(img => ({
                            label: img.name,
                            description: img.enabled ? '✓ Enabled' : '✗ Disabled',
                            image: img
                        })),
                        { placeHolder: 'Select image to toggle' }
                    );
                    if (!selected) return;
                    item = { image: selected.image };
                }

                const image = item.image as ImageInfo;
                const newEnabledState = !image.enabled;

                await imageManager.updateImageProperties(image.name, {
                    enabled: newEnabledState
                });

                await refreshAll();
                vscode.window.showInformationMessage(
                    `Image '${image.name}' ${newEnabledState ? 'enabled' : 'disabled'}!`
                );
                
            } catch (error) {
                await ErrorHandler.showError(error, 'toggle image enabled');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.deleteImage', async (item) => {
            try {
                const imageName = item?.image?.name;
                if (!imageName) {
                    const images = await imageManager.listImages();
                    const selected = await vscode.window.showQuickPick(
                        images.map(img => ({
                            label: img.name,
                            description: img.description,
                            image: img
                        })),
                        { placeHolder: 'Select image to delete' }
                    );
                    if (!selected) return;
                    item = { image: selected.image };
                }

                const image = item.image as ImageInfo;

                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete image '${image.name}'?`,
                    'Delete',
                    'Cancel'
                );

                if (confirm !== 'Delete') return;

                await imageManager.deleteImage(image.name);
                await refreshAll();
                vscode.window.showInformationMessage(`Image '${image.name}' deleted!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'delete image');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.showImageHelp', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-username/vsc-wsl-manager#images'));
        }),

        vscode.commands.registerCommand('wsl-manager.showHelp', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-username/vsc-wsl-manager#readme'));
        }),

        // Distribution commands
        vscode.commands.registerCommand('wsl-manager.refreshDistributions', async () => {
            try {
                await refreshAll();
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
                    placeHolder: 'Select a distribution to download'
                });

                if (!selectedDistro) return;

                // Find the selected distribution
                const distribution = availableDistributions.find(d => d.Name === selectedDistro.description);
                if (!distribution) return;

                // Start download with progress
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Downloading ${distribution.FriendlyName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Starting download...' });
                    
                    await distributionDownloader.downloadDistribution(distribution.Name);
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                // Refresh tree view
                await refreshAll();
                vscode.window.showInformationMessage(`${distribution.FriendlyName} downloaded and installed successfully!`);
            } catch (error) {
                await ErrorHandler.showError(error, 'download distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.createDistribution', async () => {
            try {
                const images = await imageManager.listImages();
                
                if (images.length === 0) {
                    vscode.window.showWarningMessage('No images available. Create an image first.');
                    return;
                }

                const imageItems = images.map(img => ({
                    label: img.name,
                    description: img.description,
                    image: img
                }));

                const selectedImage = await vscode.window.showQuickPick(imageItems, {
                    placeHolder: 'Select image to create distribution from'
                });

                if (!selectedImage) return;

                const distroName = await vscode.window.showInputBox({
                    prompt: 'Enter distribution name',
                    placeHolder: 'my-project-wsl',
                    validateInput: (value) => {
                        if (!value) return 'Distribution name is required';
                        const validation = InputValidator.validateDistributionName(value);
                        return validation.isValid ? undefined : validation.error;
                    }
                });

                if (!distroName) return;

                const installPath = await vscode.window.showInputBox({
                    prompt: 'Enter installation path (optional, press Enter for default)',
                    placeHolder: 'C:\\WSL\\Distributions\\my-project-wsl'
                });

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating distribution: ${distroName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Creating distribution from image...' });
                    
                    await imageManager.createDistributionFromImage(
                        selectedImage.image.name,
                        distroName,
                        installPath || undefined
                    );
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Distribution '${distroName}' created successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'create distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.importDistribution', async () => {
            try {
                const tarFile = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'TAR Files': ['tar', 'tar.gz']
                    },
                    openLabel: 'Select TAR file'
                });

                if (!tarFile || tarFile.length === 0) return;

                const distroName = await vscode.window.showInputBox({
                    prompt: 'Enter distribution name',
                    validateInput: (value) => {
                        if (!value) return 'Distribution name is required';
                        const validation = InputValidator.validateDistributionName(value);
                        return validation.isValid ? undefined : validation.error;
                    }
                });

                if (!distroName) return;

                const installPath = await vscode.window.showInputBox({
                    prompt: 'Enter installation path (optional)',
                    placeHolder: 'C:\\WSL\\Distributions\\' + distroName
                });

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Importing distribution: ${distroName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Importing TAR file...' });
                    
                    await wslManager.importDistribution(
                        distroName,
                        tarFile[0].fsPath,
                        installPath
                    );
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Distribution '${distroName}' imported successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'import distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.exportDistribution', async (item) => {
            try {
                const nameValidation = InputValidator.validateDistributionName(item.distribution.name);
                if (!nameValidation.isValid) {
                    vscode.window.showErrorMessage(`Invalid distribution name: ${nameValidation.error}`);
                    return;
                }

                const saveFile = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${item.distribution.name}.tar`),
                    filters: {
                        'TAR Files': ['tar']
                    },
                    saveLabel: 'Export'
                });

                if (!saveFile) return;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Exporting distribution: ${item.distribution.name}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Exporting to TAR file...' });
                    
                    await wslManager.exportDistribution(
                        nameValidation.sanitizedValue!,
                        saveFile.fsPath
                    );
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                vscode.window.showInformationMessage(`Distribution exported to ${saveFile.fsPath}`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'export distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.deleteDistribution', async (item) => {
            try {
                const nameValidation = InputValidator.validateDistributionName(item.distribution.name);
                if (!nameValidation.isValid) {
                    vscode.window.showErrorMessage(`Invalid distribution name: ${nameValidation.error}`);
                    return;
                }

                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete distribution '${item.distribution.name}'?`,
                    'Delete',
                    'Cancel'
                );

                if (confirm !== 'Delete') return;

                await wslManager.unregisterDistribution(nameValidation.sanitizedValue!);
                
                await refreshAll();
                vscode.window.showInformationMessage(`Distribution '${item.distribution.name}' deleted!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'delete distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.createImage', async (item) => {
            // Reuse the createImageFromDistribution logic but with pre-selected distribution
            const nameValidation = InputValidator.validateDistributionName(item.distribution.name);
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
                placeHolder: 'Development environment'
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
                        author: 'VS Code WSL Manager',
                        enabled: true
                    };
                    
                    await imageManager.createImage(nameValidation.sanitizedValue!, imageName, metadata);
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Image '${imageName}' created successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'create image');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.openTerminal', (item) => {
            const nameValidation = InputValidator.validateDistributionName(item.distribution.name);
            if (!nameValidation.isValid) {
                vscode.window.showErrorMessage(`Invalid distribution name: ${nameValidation.error}`);
                return;
            }

            const displayName = InputValidator.sanitizeForDisplay(item.distribution.name);
            const terminal = vscode.window.createTerminal({
                name: `WSL: ${displayName}`,
                shellPath: 'wsl.exe',
                shellArgs: ['-d', nameValidation.sanitizedValue!]
            });
            terminal.show();
        })
    );

    // Initialize terminal profiles
    (async () => {
        try {
            const distributions = await wslManager.listDistributions();
            const images = await imageManager.listImages();
            terminalProfileManager?.registerProfiles(distributions, images);
        } catch (error) {
            console.error('Failed to initialize terminal profiles:', error);
        }
    })();

    // Set up auto-refresh
    const watcher = vscode.workspace.createFileSystemWatcher('**/.wsl/**');
    context.subscriptions.push(
        watcher,
        watcher.onDidCreate(() => refreshAll()),
        watcher.onDidDelete(() => refreshAll()),
        watcher.onDidChange(() => refreshAll())
    );
}

/**
 * Deactivates the WSL Manager extension
 * 
 * @remarks
 * This function is called when the extension is deactivated.
 * It cleans up resources like terminal profile providers.
 */
export function deactivate() {
    // Dispose terminal profile manager
    terminalProfileManager?.dispose();
    terminalProfileManager = undefined;
    
    console.log('WSL Manager extension deactivated');
}