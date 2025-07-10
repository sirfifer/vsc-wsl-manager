# WSL Manager Extension Setup Script
# Run this script in the root of your empty repository

Write-Host "Setting up WSL Manager Extension structure..." -ForegroundColor Green

# Create directories
Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "src"
New-Item -ItemType Directory -Force -Path "resources"
New-Item -ItemType Directory -Force -Path ".vscode"

# Create package.json
Write-Host "Creating package.json..." -ForegroundColor Yellow
@'
{
  "name": "wsl-image-manager",
  "displayName": "WSL Image Manager",
  "description": "Manage WSL images and integrate them as VS Code terminal profiles",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "wsl-manager.refreshDistributions",
        "title": "WSL: Refresh Distributions",
        "icon": "$(refresh)"
      },
      {
        "command": "wsl-manager.createDistribution",
        "title": "WSL: Create New Distribution",
        "icon": "$(add)"
      },
      {
        "command": "wsl-manager.importDistribution",
        "title": "WSL: Import Distribution from TAR"
      },
      {
        "command": "wsl-manager.exportDistribution",
        "title": "WSL: Export Distribution to TAR"
      },
      {
        "command": "wsl-manager.deleteDistribution",
        "title": "WSL: Delete Distribution",
        "icon": "$(trash)"
      },
      {
        "command": "wsl-manager.openTerminal",
        "title": "WSL: Open Terminal",
        "icon": "$(terminal)"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "wsl-manager",
          "title": "WSL Manager",
          "icon": "resources/wsl-icon.svg"
        }
      ]
    },
    "views": {
      "wsl-manager": [
        {
          "id": "wslDistributions",
          "name": "WSL Distributions",
          "icon": "$(server)",
          "contextualTitle": "WSL Distributions"
        }
      ]
    },
    "menus": {
      "view/title": [
        {
          "command": "wsl-manager.refreshDistributions",
          "when": "view == wslDistributions",
          "group": "navigation"
        },
        {
          "command": "wsl-manager.createDistribution",
          "when": "view == wslDistributions",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "wsl-manager.openTerminal",
          "when": "view == wslDistributions && viewItem == distribution",
          "group": "inline"
        },
        {
          "command": "wsl-manager.exportDistribution",
          "when": "view == wslDistributions && viewItem == distribution"
        },
        {
          "command": "wsl-manager.deleteDistribution",
          "when": "view == wslDistributions && viewItem == distribution"
        }
      ]
    },
    "configuration": {
      "title": "WSL Manager",
      "properties": {
        "wsl-manager.defaultDistributionPath": {
          "type": "string",
          "default": "",
          "description": "Default path for storing WSL distributions"
        },
        "wsl-manager.autoRegisterProfiles": {
          "type": "boolean",
          "default": true,
          "description": "Automatically register WSL distributions as terminal profiles"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "@typescript-eslint/eslint-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.3"
  }
}
'@ | Out-File -FilePath "package.json" -Encoding UTF8

# Create tsconfig.json
Write-Host "Creating tsconfig.json..." -ForegroundColor Yellow
@'
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}
'@ | Out-File -FilePath "tsconfig.json" -Encoding UTF8

# Create .eslintrc.json
Write-Host "Creating .eslintrc.json..." -ForegroundColor Yellow
@'
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 6,
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint"
  ],
  "rules": {
    "@typescript-eslint/naming-convention": "warn",
    "@typescript-eslint/semi": "warn",
    "curly": "warn",
    "eqeqeq": "warn",
    "no-throw-literal": "warn",
    "semi": "off"
  }
}
'@ | Out-File -FilePath ".eslintrc.json" -Encoding UTF8

# Create .vscodeignore
Write-Host "Creating .vscodeignore..." -ForegroundColor Yellow
@'
.vscode/**
.vscode-test/**
src/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/.eslintrc.json
**/*.map
**/*.ts
'@ | Out-File -FilePath ".vscodeignore" -Encoding UTF8

# Create .gitignore
Write-Host "Creating .gitignore..." -ForegroundColor Yellow
@'
out
dist
node_modules
.vscode-test/
*.vsix
'@ | Out-File -FilePath ".gitignore" -Encoding UTF8

# Create src/extension.ts
Write-Host "Creating src/extension.ts..." -ForegroundColor Yellow
@'
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
'@ | Out-File -FilePath "src/extension.ts" -Encoding UTF8

# Create src/wslManager.ts
Write-Host "Creating src/wslManager.ts..." -ForegroundColor Yellow
@'
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export interface WSLDistribution {
    name: string;
    state: 'Running' | 'Stopped';
    version: string;
    default: boolean;
}

export class WSLManager {
    private readonly wslCommand = 'wsl.exe';

    async listDistributions(): Promise<WSLDistribution[]> {
        try {
            const { stdout } = await execAsync(`${this.wslCommand} --list --verbose`);
            return this.parseDistributions(stdout);
        } catch (error) {
            console.error('Failed to list WSL distributions:', error);
            return [];
        }
    }

    private parseDistributions(output: string): WSLDistribution[] {
        const lines = output.split('\n').slice(1); // Skip header
        const distributions: WSLDistribution[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Parse WSL output format
            const isDefault = trimmed.startsWith('*');
            const parts = trimmed.replace('*', '').trim().split(/\s+/);
            
            if (parts.length >= 3) {
                distributions.push({
                    name: parts[0],
                    state: parts[1] as 'Running' | 'Stopped',
                    version: parts[2],
                    default: isDefault
                });
            }
        }

        return distributions;
    }

    async createDistribution(name: string, baseDistro: string): Promise<void> {
        // First, ensure the base distribution is installed
        await this.ensureBaseDistribution(baseDistro);

        // Export the base distribution
        const tempPath = path.join(process.env.TEMP || '/tmp', `${name}-base.tar`);
        await this.exportDistribution(baseDistro, tempPath);

        // Import as new distribution
        const installPath = this.getDefaultInstallPath(name);
        await this.importDistribution(name, tempPath, installPath);

        // Clean up temp file
        try {
            await fs.promises.unlink(tempPath);
        } catch (error) {
            console.error('Failed to clean up temp file:', error);
        }
    }

    async importDistribution(name: string, tarPath: string, installLocation?: string): Promise<void> {
        const location = installLocation || this.getDefaultInstallPath(name);
        
        // Ensure the directory exists
        await fs.promises.mkdir(location, { recursive: true });

        const command = `${this.wslCommand} --import "${name}" "${location}" "${tarPath}"`;
        await execAsync(command);
    }

    async exportDistribution(name: string, exportPath: string): Promise<void> {
        const command = `${this.wslCommand} --export "${name}" "${exportPath}"`;
        await execAsync(command);
    }

    async unregisterDistribution(name: string): Promise<void> {
        const command = `${this.wslCommand} --unregister "${name}"`;
        await execAsync(command);
    }

    async terminateDistribution(name: string): Promise<void> {
        const command = `${this.wslCommand} --terminate "${name}"`;
        await execAsync(command);
    }

    async setDefaultDistribution(name: string): Promise<void> {
        const command = `${this.wslCommand} --set-default "${name}"`;
        await execAsync(command);
    }

    private async ensureBaseDistribution(distroName: string): Promise<void> {
        const distributions = await this.listDistributions();
        const exists = distributions.some(d => d.name.toLowerCase() === distroName.toLowerCase());

        if (!exists) {
            throw new Error(`Base distribution '${distroName}' is not installed. Please install it from the Microsoft Store first.`);
        }
    }

    private getDefaultInstallPath(name: string): string {
        const config = vscode.workspace.getConfiguration('wsl-manager');
        const defaultPath = config.get<string>('defaultDistributionPath');
        
        if (defaultPath) {
            return path.join(defaultPath, name);
        }

        // Default to user's home directory
        const homeDir = process.env.USERPROFILE || process.env.HOME || '';
        return path.join(homeDir, 'WSL', 'Distributions', name);
    }

    async runCommand(distribution: string, command: string): Promise<string> {
        const { stdout } = await execAsync(`${this.wslCommand} -d "${distribution}" ${command}`);
        return stdout;
    }

    async getDistributionInfo(name: string): Promise<any> {
        try {
            const info: any = { name };

            // Get kernel version
            info.kernel = await this.runCommand(name, 'uname -r');
            
            // Get OS info
            try {
                info.os = await this.runCommand(name, 'cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \\"');
            } catch {
                info.os = 'Unknown';
            }

            // Get memory info
            try {
                const memInfo = await this.runCommand(name, 'free -h | grep Mem | awk \'{print $2}\'');
                info.totalMemory = memInfo.trim();
            } catch {
                info.totalMemory = 'Unknown';
            }

            return info;
        } catch (error) {
            console.error(`Failed to get info for distribution ${name}:`, error);
            return { name, error: error.message };
        }
    }
}
'@ | Out-File -FilePath "src/wslManager.ts" -Encoding UTF8

# Create src/wslTreeDataProvider.ts
Write-Host "Creating src/wslTreeDataProvider.ts..." -ForegroundColor Yellow
@'
import * as vscode from 'vscode';
import { WSLManager, WSLDistribution } from './wslManager';
import * as path from 'path';

export class WSLTreeDataProvider implements vscode.TreeDataProvider<WSLTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WSLTreeItem | undefined | null | void> = new vscode.EventEmitter<WSLTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WSLTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private wslManager: WSLManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WSLTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WSLTreeItem): Promise<WSLTreeItem[]> {
        if (!element) {
            // Root level - show distributions
            const distributions = await this.wslManager.listDistributions();
            return distributions.map(distro => new WSLTreeItem(
                distro.name,
                distro,
                vscode.TreeItemCollapsibleState.Collapsed
            ));
        } else {
            // Distribution details
            const info = await this.wslManager.getDistributionInfo(element.distribution.name);
            const items: WSLTreeItem[] = [];

            items.push(new WSLTreeItem(
                `State: ${element.distribution.state}`,
                element.distribution,
                vscode.TreeItemCollapsibleState.None,
                'info'
            ));

            items.push(new WSLTreeItem(
                `Version: WSL${element.distribution.version}`,
                element.distribution,
                vscode.TreeItemCollapsibleState.None,
                'info'
            ));

            if (element.distribution.default) {
                items.push(new WSLTreeItem(
                    'Default Distribution',
                    element.distribution,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            if (info.os) {
                items.push(new WSLTreeItem(
                    `OS: ${info.os.trim()}`,
                    element.distribution,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            if (info.kernel) {
                items.push(new WSLTreeItem(
                    `Kernel: ${info.kernel.trim()}`,
                    element.distribution,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            if (info.totalMemory) {
                items.push(new WSLTreeItem(
                    `Memory: ${info.totalMemory}`,
                    element.distribution,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            return items;
        }
    }
}

class WSLTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly distribution: WSLDistribution,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'distribution' | 'info' = 'distribution'
    ) {
        super(label, collapsibleState);

        this.tooltip = this.label;
        this.contextValue = type;

        if (type === 'distribution') {
            this.iconPath = this.getIcon(distribution);
            this.description = distribution.state;
            
            if (distribution.default) {
                this.description += ' (default)';
            }
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }

    private getIcon(distribution: WSLDistribution): vscode.ThemeIcon {
        if (distribution.state === 'Running') {
            return new vscode.ThemeIcon('vm-active', new vscode.ThemeColor('charts.green'));
        } else {
            return new vscode.ThemeIcon('vm', new vscode.ThemeColor('charts.gray'));
        }
    }
}
'@ | Out-File -FilePath "src/wslTreeDataProvider.ts" -Encoding UTF8

# Create src/terminalProfileManager.ts
Write-Host "Creating src/terminalProfileManager.ts..." -ForegroundColor Yellow
@'
import * as vscode from 'vscode';
import { WSLDistribution } from './wslManager';

export class TerminalProfileManager {
    private readonly profilePrefix = 'WSL-';

    constructor(private context: vscode.ExtensionContext) {}

    async updateTerminalProfiles(distributions: WSLDistribution[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('terminal.integrated.profiles.windows');
        const profiles = config.get<any>({}) || {};

        // Remove old WSL profiles managed by this extension
        const managedProfiles = Object.keys(profiles).filter(key => key.startsWith(this.profilePrefix));
        managedProfiles.forEach(key => delete profiles[key]);

        // Add current WSL distributions
        for (const distro of distributions) {
            const profileName = `${this.profilePrefix}${distro.name}`;
            profiles[profileName] = {
                path: 'wsl.exe',
                args: ['-d', distro.name],
                icon: 'terminal-linux',
                overrideName: true
            };
        }

        // Update configuration
        await config.update(undefined, profiles, vscode.ConfigurationTarget.Global);

        // Store the managed profiles list
        await this.context.globalState.update('managedProfiles', distributions.map(d => d.name));
    }

    async removeTerminalProfiles(): Promise<void> {
        const config = vscode.workspace.getConfiguration('terminal.integrated.profiles.windows');
        const profiles = config.get<any>({}) || {};

        // Remove all managed profiles
        const managedProfiles = Object.keys(profiles).filter(key => key.startsWith(this.profilePrefix));
        managedProfiles.forEach(key => delete profiles[key]);

        await config.update(undefined, profiles, vscode.ConfigurationTarget.Global);
        await this.context.globalState.update('managedProfiles', []);
    }

    async ensureDefaultProfile(distributionName: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('terminal.integrated');
        const defaultProfile = config.get<string>('defaultProfile.windows');

        const profileName = `${this.profilePrefix}${distributionName}`;
        
        // Check if this distribution is set as default
        if (defaultProfile !== profileName) {
            const setAsDefault = await vscode.window.showInformationMessage(
                `Would you like to set ${distributionName} as your default terminal?`,
                'Yes', 'No'
            );

            if (setAsDefault === 'Yes') {
                await config.update('defaultProfile.windows', profileName, vscode.ConfigurationTarget.Global);
            }
        }
    }
}
'@ | Out-File -FilePath "src/terminalProfileManager.ts" -Encoding UTF8

# Create resources/wsl-icon.svg
Write-Host "Creating resources/wsl-icon.svg..." -ForegroundColor Yellow
@'
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 22V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 7L12 12L2 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2 17L12 12L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'@ | Out-File -FilePath "resources/wsl-icon.svg" -Encoding UTF8

# Create .vscode/launch.json
Write-Host "Creating .vscode/launch.json..." -ForegroundColor Yellow
@'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/out/**/*.js"
      ],
      "preLaunchTask": "${defaultBuildTask}"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
      ],
      "outFiles": [
        "${workspaceFolder}/out/test/**/*.js"
      ],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
'@ | Out-File -FilePath ".vscode/launch.json" -Encoding UTF8

# Create .vscode/tasks.json
Write-Host "Creating .vscode/tasks.json..." -ForegroundColor Yellow
@'
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
      "presentation": {
        "reveal": "never"
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
'@ | Out-File -FilePath ".vscode/tasks.json" -Encoding UTF8

# Create README.md
Write-Host "Creating README.md..." -ForegroundColor Yellow
@'
# WSL Image Manager for VS Code

A powerful VS Code extension for managing Windows Subsystem for Linux (WSL) distributions with seamless terminal integration.

## Features

- **Visual WSL Management**: View all your WSL distributions in a dedicated sidebar
- **Create New Distributions**: Clone existing distributions to create new isolated environments
- **Import/Export**: Import TAR files as new distributions or export existing ones
- **Terminal Integration**: Automatically registers WSL distributions as VS Code terminal profiles
- **Real-time Status**: See which distributions are running or stopped
- **Distribution Info**: View detailed information about each distribution (OS, kernel, memory)

## Requirements

- Windows 10/11 with WSL 2 installed
- VS Code 1.74.0 or higher
- At least one WSL distribution installed (for cloning)

## Installation

1. Clone this repository
2. Run `npm install` in the project directory
3. Open the project in VS Code
4. Press `F5` to run the extension in a new Extension Development Host window

## Usage

### Managing Distributions

1. **View Distributions**: Click the WSL Manager icon in the Activity Bar to see all distributions
2. **Create New**: Click the `+` button to create a new distribution by cloning an existing one
3. **Import**: Right-click in the view and select "Import Distribution from TAR"
4. **Export**: Right-click on a distribution and select "Export Distribution to TAR"
5. **Delete**: Right-click on a distribution and select "Delete Distribution"

### Terminal Integration

The extension automatically registers all WSL distributions as terminal profiles. To use them:

1. Open the terminal dropdown (click the `+` button dropdown in the terminal)
2. Look for profiles starting with "WSL-" followed by your distribution name
3. Select a profile to open a new terminal in that WSL environment

## Development

Press F5 in VS Code to launch the extension in a new Extension Development Host window.

## License

MIT
'@ | Out-File -FilePath "README.md" -Encoding UTF8

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run 'npm install' to install dependencies" -ForegroundColor White
Write-Host "2. Press F5 in VS Code to test the extension" -ForegroundColor White
Write-Host "3. The WSL Manager icon will appear in the Activity Bar" -ForegroundColor White