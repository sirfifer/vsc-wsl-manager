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
