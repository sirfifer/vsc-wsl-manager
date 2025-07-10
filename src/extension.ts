import * as vscode from 'vscode';
import { WSLManager } from './wslManager';
import { WSLTreeDataProvider } from './wslTreeDataProvider';
import { TerminalProfileManager } from './terminalProfileManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('WSL Manager extension is now active!');

    // Initialize managers
    const wslManager = new WSLManager();
    const terminalProfileManager = new TerminalProfileManager(context);
    const treeDataProvider = new WSLTreeDataProvider(wslManager);

    // Register tree view
    const treeView = vscode.window.createTreeView('wslDistributions', {
        treeDataProvider,
        showCollapseAll: true
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('wsl-manager.refreshDistributions', async () => {
            await treeDataProvider.refresh();
            await terminalProfileManager.updateTerminalProfiles(await wslManager.listDistributions());
        }),

        vscode.commands.registerCommand('wsl-manager.createDistribution', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter distribution name',
                placeHolder: 'my-custom-wsl'
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
                await terminalProfileManager.updateTerminalProfiles(await wslManager.listDistributions());
                vscode.window.showInformationMessage(`Distribution '${name}' created successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create distribution: ${error}`);
            }
        }),

        vscode.commands.registerCommand('wsl-manager.importDistribution', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter distribution name',
                placeHolder: 'imported-wsl'
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
                placeHolder: 'C:\\WSL\\imported-wsl'
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
                await terminalProfileManager.updateTerminalProfiles(await wslManager.listDistributions());
                vscode.window.showInformationMessage(`Distribution '${name}' imported successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to import distribution: ${error}`);
            }
        }),

        vscode.commands.registerCommand('wsl-manager.exportDistribution', async (item) => {
            const saveLocation = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${item.name}.tar`),
                filters: {
                    'TAR files': ['tar']
                }
            });

            if (!saveLocation) return;

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Exporting WSL distribution: ${item.name}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Exporting...' });
                    await wslManager.exportDistribution(item.name, saveLocation.fsPath);
                    progress.report({ increment: 100, message: 'Complete!' });
                });

                vscode.window.showInformationMessage(`Distribution '${item.name}' exported successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export distribution: ${error}`);
            }
        }),

        vscode.commands.registerCommand('wsl-manager.deleteDistribution', async (item) => {
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the distribution '${item.name}'? This action cannot be undone.`,
                'Yes', 'No'
            );

            if (confirm !== 'Yes') return;

            try {
                await wslManager.unregisterDistribution(item.name);
                await treeDataProvider.refresh();
                await terminalProfileManager.updateTerminalProfiles(await wslManager.listDistributions());
                vscode.window.showInformationMessage(`Distribution '${item.name}' deleted successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete distribution: ${error}`);
            }
        }),

        vscode.commands.registerCommand('wsl-manager.openTerminal', (item) => {
            const terminal = vscode.window.createTerminal({
                name: `WSL: ${item.name}`,
                shellPath: 'wsl.exe',
                shellArgs: ['-d', item.name]
            });
            terminal.show();
        })
    );

    // Auto-refresh on activation
    vscode.commands.executeCommand('wsl-manager.refreshDistributions');

    // Watch for terminal profile changes
    if (vscode.workspace.getConfiguration('wsl-manager').get('autoRegisterProfiles')) {
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('terminal.integrated.profiles.windows')) {
                    wslManager.listDistributions().then(distros => {
                        terminalProfileManager.updateTerminalProfiles(distros);
                    });
                }
            })
        );
    }
}

export function deactivate() {
    console.log('WSL Manager extension is now deactivated');
}
