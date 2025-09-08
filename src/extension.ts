import * as vscode from 'vscode';
import { WSLManager } from './wslManager';
import { WSLTerminalProfileManager } from './terminal/wslTerminalProfileProvider';

// New Two-World Architecture imports
import { DistroManager } from './distros/DistroManager';
import { DistroDownloader } from './distros/DistroDownloader';
import { WSLImageManager } from './images/WSLImageManager';
import { ManifestManager } from './manifest/ManifestManager';
import { DistroTreeProvider } from './views/DistroTreeProvider';
import { ImageTreeProvider } from './views/ImageTreeProvider';

// Utilities
import { InputValidator } from './utils/inputValidator';
import { ErrorHandler } from './errors/errorHandler';
import { Logger } from './utils/logger';

const logger = Logger.getInstance();

// Store managers for cleanup on deactivation
let terminalProfileManager: WSLTerminalProfileManager | undefined;
let distroTreeProvider: DistroTreeProvider | undefined;
let imageTreeProvider: ImageTreeProvider | undefined;

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

    // Initialize core managers
    const wslManager = new WSLManager();
    terminalProfileManager = new WSLTerminalProfileManager();
    
    // Initialize Two-World Architecture managers
    const manifestManager = new ManifestManager();
    const distroManager = new DistroManager();
    const distroDownloader = new DistroDownloader(distroManager);
    const imageManager = new WSLImageManager(manifestManager, distroManager);
    
    // Create tree data providers
    distroTreeProvider = new DistroTreeProvider(distroManager);
    imageTreeProvider = new ImageTreeProvider(imageManager);

    // Register tree views
    const distroView = vscode.window.createTreeView('wslDistributions', {
        treeDataProvider: distroTreeProvider,
        showCollapseAll: true
    });
    
    const imageView = vscode.window.createTreeView('wslImages', {
        treeDataProvider: imageTreeProvider,
        showCollapseAll: true
    });

    // Helper function to refresh all views and terminal profiles
    async function refreshAll() {
        distroTreeProvider?.refresh();
        imageTreeProvider?.refresh();
        
        // Update terminal profiles with active images
        const images = await imageManager.listImages();
        const wslDistributions = images
            .filter(img => img.enabled)
            .map(img => ({
                name: img.name,
                default: false,
                state: 'Stopped' as const,
                version: String(img.wslVersion || 2)
            }));
        
        terminalProfileManager?.updateProfiles(wslDistributions, images);
    }

    // Register commands
    context.subscriptions.push(
        // ===== Distro Commands =====
        vscode.commands.registerCommand('wsl-manager.refreshDistributions', async () => {
            try {
                await refreshAll();
                vscode.window.showInformationMessage('Distributions refreshed');
            } catch (error) {
                await ErrorHandler.showError(error, 'refresh distributions');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.downloadDistribution', async () => {
            try {
                const distros = await distroManager.listDistros();
                const downloadable = distros.filter(d => !d.available);
                
                if (downloadable.length === 0) {
                    vscode.window.showInformationMessage('All available distributions are already downloaded');
                    return;
                }

                const selected = await vscode.window.showQuickPick(
                    downloadable.map(d => ({
                        label: d.displayName,
                        description: d.version,
                        detail: d.description,
                        distro: d
                    })),
                    { placeHolder: 'Select distribution to download' }
                );

                if (!selected) return;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Downloading ${selected.distro.displayName}`,
                    cancellable: true
                }, async (progress, token) => {
                    await distroDownloader.downloadDistro(selected.distro.name, {
                        onProgress: (downloadProgress) => {
                            const message = `${(downloadProgress.percent || 0).toFixed(0)}% - ${formatBytes(downloadProgress.downloaded)} / ${formatBytes(downloadProgress.total)}`;
                            progress.report({ 
                                increment: undefined,
                                message 
                            });
                        }
                    });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Downloaded ${selected.distro.displayName} successfully!`);
            } catch (error) {
                await ErrorHandler.showError(error, 'download distribution');
            }
        }),

        // ===== Image Commands =====
        vscode.commands.registerCommand('wsl-manager.refreshImages', async () => {
            try {
                await refreshAll();
                vscode.window.showInformationMessage('Images refreshed');
            } catch (error) {
                await ErrorHandler.showError(error, 'refresh images');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.createDistribution', async () => {
            try {
                // Get available distros
                const distros = await distroManager.listDistros();
                const available = distros.filter(d => d.available);
                
                if (available.length === 0) {
                    vscode.window.showWarningMessage('No distributions available. Download a distribution first.');
                    return;
                }

                const selectedDistro = await vscode.window.showQuickPick(
                    available.map(d => ({
                        label: d.displayName,
                        description: d.version,
                        detail: `${d.description} (${formatBytes(d.size || 0)})`,
                        distro: d
                    })),
                    { placeHolder: 'Select distribution to create image from' }
                );

                if (!selectedDistro) return;

                const imageName = await vscode.window.showInputBox({
                    prompt: 'Enter name for the new WSL instance',
                    placeHolder: 'my-dev-environment',
                    validateInput: (value) => {
                        if (!value) return 'Name is required';
                        const validation = InputValidator.validateDistributionName(value);
                        if (!validation.isValid) return validation.error;
                        return undefined;
                    }
                });

                if (!imageName) return;

                const description = await vscode.window.showInputBox({
                    prompt: 'Enter description (optional)',
                    placeHolder: 'Development environment for my project'
                });

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating WSL instance: ${imageName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Importing distribution...' });
                    
                    await imageManager.createFromDistro(selectedDistro.distro.name, imageName, {
                        displayName: imageName,
                        description,
                        enableTerminal: true
                    });
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Created WSL instance '${imageName}' successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'create distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.createImage', async (item) => {
            try {
                let sourceImageName: string | undefined;
                
                if (item?.image?.name) {
                    sourceImageName = item.image.name;
                } else {
                    // Show picker if not called from tree item
                    const images = await imageManager.listImages();
                    if (images.length === 0) {
                        vscode.window.showWarningMessage('No WSL instances available. Create one from a distribution first.');
                        return;
                    }

                    const selected = await vscode.window.showQuickPick(
                        images.map(img => ({
                            label: img.displayName || img.name,
                            description: `from ${img.source}`,
                            detail: img.description,
                            image: img
                        })),
                        { placeHolder: 'Select WSL instance to clone' }
                    );

                    if (!selected) return;
                    sourceImageName = selected.image.name;
                }

                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter name for the cloned instance',
                    value: `${sourceImageName}-clone`,
                    validateInput: (value) => {
                        if (!value) return 'Name is required';
                        const validation = InputValidator.validateDistributionName(value);
                        if (!validation.isValid) return validation.error;
                        return undefined;
                    }
                });

                if (!newName) return;

                const description = await vscode.window.showInputBox({
                    prompt: 'Enter description (optional)',
                    placeHolder: `Clone of ${sourceImageName}`
                });

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Cloning WSL instance: ${newName}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Exporting source...' });
                    
                    await imageManager.cloneImage(sourceImageName!, newName, {
                        displayName: newName,
                        description,
                        enableTerminal: true
                    });
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Cloned '${sourceImageName}' to '${newName}' successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'clone image');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.deleteDistribution', async (item) => {
            try {
                let imageName: string | undefined;
                
                if (item?.image?.name) {
                    imageName = item.image.name;
                } else {
                    const images = await imageManager.listImages();
                    if (images.length === 0) {
                        vscode.window.showInformationMessage('No WSL instances to delete');
                        return;
                    }

                    const selected = await vscode.window.showQuickPick(
                        images.map(img => ({
                            label: img.displayName || img.name,
                            description: `from ${img.source}`,
                            image: img
                        })),
                        { placeHolder: 'Select WSL instance to delete' }
                    );

                    if (!selected) return;
                    imageName = selected.image.name;
                }

                const confirmation = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete WSL instance '${imageName}'? This action cannot be undone.`,
                    { modal: true },
                    'Delete'
                );

                if (confirmation !== 'Delete') return;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Deleting WSL instance: ${imageName}`,
                    cancellable: false
                }, async () => {
                    await imageManager.deleteImage(imageName!);
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Deleted WSL instance '${imageName}' successfully`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'delete distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.editImageProperties', async (item) => {
            try {
                let imageName: string | undefined;
                
                if (item?.image?.name) {
                    imageName = item.image.name;
                } else {
                    const images = await imageManager.listImages();
                    const selected = await vscode.window.showQuickPick(
                        images.map(img => ({
                            label: img.displayName || img.name,
                            description: img.enabled ? '✓ Enabled' : '✗ Disabled',
                            image: img
                        })),
                        { placeHolder: 'Select image to edit' }
                    );
                    if (!selected) return;
                    imageName = selected.image.name;
                }

                const image = await imageManager.getImageInfo(imageName!);
                if (!image) return;

                const newDisplayName = await vscode.window.showInputBox({
                    prompt: 'Display name (press Enter to keep current)',
                    value: image.displayName || image.name
                });

                if (!newDisplayName) return;

                const newDescription = await vscode.window.showInputBox({
                    prompt: 'Description (press Enter to keep current)',
                    value: image.description || '',
                    placeHolder: 'Description of the image'
                });

                const enabledChoice = await vscode.window.showQuickPick(
                    [
                        { label: '✓ Enabled', description: 'Show in terminal profiles', value: true },
                        { label: '✗ Disabled', description: 'Hide from terminal profiles', value: false }
                    ],
                    {
                        placeHolder: 'Enable or disable terminal profile'
                    }
                );

                if (!enabledChoice) return;

                await imageManager.updateImageProperties(imageName!, {
                    displayName: newDisplayName,
                    description: newDescription,
                    enabled: enabledChoice.value
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Updated properties for '${imageName}'`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'edit image properties');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.toggleImageEnabled', async (item) => {
            try {
                let imageName: string | undefined;
                
                if (item?.image?.name) {
                    imageName = item.image.name;
                } else {
                    const images = await imageManager.listImages();
                    const selected = await vscode.window.showQuickPick(
                        images.map(img => ({
                            label: img.displayName || img.name,
                            description: img.enabled ? '✓ Enabled' : '✗ Disabled',
                            image: img
                        })),
                        { placeHolder: 'Select image to toggle' }
                    );
                    if (!selected) return;
                    imageName = selected.image.name;
                }

                const image = await imageManager.getImageInfo(imageName!);
                if (!image) return;

                await imageManager.updateImageProperties(imageName!, {
                    enabled: !image.enabled
                });

                await refreshAll();
                const status = !image.enabled ? 'enabled' : 'disabled';
                vscode.window.showInformationMessage(`Terminal profile for '${imageName}' ${status}`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'toggle image enabled');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.openTerminal', async (imageName?: string) => {
            try {
                if (!imageName) {
                    const images = await imageManager.listImages();
                    const enabledImages = images.filter(img => img.enabled);
                    
                    if (enabledImages.length === 0) {
                        vscode.window.showWarningMessage('No enabled WSL instances available');
                        return;
                    }

                    const selected = await vscode.window.showQuickPick(
                        enabledImages.map(img => ({
                            label: img.displayName || img.name,
                            description: `from ${img.source}`,
                            name: img.name
                        })),
                        { placeHolder: 'Select WSL instance to open terminal' }
                    );

                    if (!selected) return;
                    imageName = selected.name;
                }

                const terminal = vscode.window.createTerminal({
                    name: `WSL: ${imageName}`,
                    shellPath: 'wsl.exe',
                    shellArgs: ['-d', imageName]
                });
                
                terminal.show();
            } catch (error) {
                await ErrorHandler.showError(error, 'open terminal');
            }
        }),

        // Legacy/compatibility commands
        vscode.commands.registerCommand('wsl-manager.importDistribution', async () => {
            try {
                const tarFile = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'TAR files': ['tar', 'tar.gz', 'tgz']
                    },
                    title: 'Select TAR file to import'
                });

                if (!tarFile || tarFile.length === 0) return;

                const distroName = await vscode.window.showInputBox({
                    prompt: 'Enter name for the imported distribution',
                    placeHolder: 'imported-distro',
                    validateInput: (value) => {
                        if (!value) return 'Name is required';
                        const validation = InputValidator.validateDistributionName(value);
                        if (!validation.isValid) return validation.error;
                        return undefined;
                    }
                });

                if (!distroName) return;

                const displayName = await vscode.window.showInputBox({
                    prompt: 'Enter display name',
                    value: distroName
                });

                const description = await vscode.window.showInputBox({
                    prompt: 'Enter description (optional)',
                    placeHolder: 'Custom imported distribution'
                });

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Importing distribution: ${distroName}`,
                    cancellable: false
                }, async () => {
                    await distroManager.importDistro(
                        tarFile[0].fsPath,
                        distroName,
                        displayName || distroName,
                        description
                    );
                });

                await refreshAll();
                vscode.window.showInformationMessage(`Imported distribution '${distroName}' successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'import distribution');
            }
        }),

        vscode.commands.registerCommand('wsl-manager.exportDistribution', async () => {
            try {
                const images = await imageManager.listImages();
                
                if (images.length === 0) {
                    vscode.window.showWarningMessage('No WSL instances available to export');
                    return;
                }

                const selected = await vscode.window.showQuickPick(
                    images.map(img => ({
                        label: img.displayName || img.name,
                        description: `from ${img.source}`,
                        name: img.name
                    })),
                    { placeHolder: 'Select WSL instance to export' }
                );

                if (!selected) return;

                const saveFile = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${selected.name}.tar`),
                    filters: {
                        'TAR files': ['tar']
                    },
                    title: 'Export WSL instance'
                });

                if (!saveFile) return;

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Exporting ${selected.name}`,
                    cancellable: false
                }, async () => {
                    await wslManager.exportDistribution(selected.name, saveFile.fsPath);
                });

                vscode.window.showInformationMessage(`Exported '${selected.name}' successfully!`);
                
            } catch (error) {
                await ErrorHandler.showError(error, 'export distribution');
            }
        }),

        // Help commands
        vscode.commands.registerCommand('wsl-manager.showHelp', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/en-us/windows/wsl/'));
        }),

        vscode.commands.registerCommand('wsl-manager.showImageHelp', () => {
            const message = `WSL Manager uses a Two-World architecture:

**Distros (Templates)**: Pristine distribution tar files that serve as clean templates. Download once, use many times.

**Images (Instances)**: Working WSL distributions created from distros. Each image tracks its lineage through a manifest system.

**Benefits**:
• Create multiple dev environments from one template
• Clone existing setups for different projects
• Track modifications and lineage
• No admin privileges required`;

            vscode.window.showInformationMessage(message, { modal: true });
        })
    );

    // Initialize terminal profiles on activation
    refreshAll().catch(error => {
        logger.error('Failed to initialize extension:', error);
    });

    // Add tree views to subscriptions
    context.subscriptions.push(distroView, imageView);
}

/**
 * Deactivates the extension
 */
export function deactivate() {
    // Clean up terminal profiles
    if (terminalProfileManager) {
        terminalProfileManager.dispose();
        terminalProfileManager = undefined;
    }
    
    logger.info('WSL Manager extension deactivated');
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}