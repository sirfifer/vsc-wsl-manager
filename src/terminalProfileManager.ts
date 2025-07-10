import * as vscode from 'vscode';
import { WSLDistribution } from './wslManager';
import { ErrorHandler, WSLError, ErrorType } from './errors/errorHandler';
import { logger } from './utils/logger';

/**
 * Manages VS Code terminal profiles for WSL distributions
 * 
 * @remarks
 * This class automatically creates and manages terminal profiles
 * for each WSL distribution, allowing users to easily open terminals
 * in any WSL environment.
 * 
 * @example
 * ```typescript
 * const manager = new TerminalProfileManager(context);
 * await manager.updateTerminalProfiles(distributions);
 * ```
 */
export class TerminalProfileManager {
    private readonly profilePrefix = 'WSL-';

    /**
     * Creates a new terminal profile manager
     * @param context - VS Code extension context for state persistence
     */
    constructor(private context: vscode.ExtensionContext) {}

    async updateTerminalProfiles(distributions: WSLDistribution[]): Promise<void> {
        const startTime = Date.now();
        logger.info('Updating terminal profiles', { count: distributions.length });
        
        try {
            const config = vscode.workspace.getConfiguration('terminal.integrated.profiles.windows');
            const profiles = config.get<any>('', {}) || {};
            
            // Create backup for rollback
            const backup = JSON.parse(JSON.stringify(profiles));

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

            // Update configuration with error handling
            try {
                await config.update('', profiles, vscode.ConfigurationTarget.Global);
            } catch (updateError) {
                // Rollback on failure
                logger.error('Failed to update terminal profiles, attempting rollback', updateError);
                try {
                    await config.update('', backup, vscode.ConfigurationTarget.Global);
                } catch (rollbackError) {
                    throw new WSLError(
                        ErrorType.PERMISSION_DENIED,
                        'Failed to update terminal profiles',
                        'Configuration update failed and rollback was unsuccessful',
                        ['Check VS Code settings permissions', 'Manually update terminal profiles']
                    );
                }
                throw updateError;
            }

            // Store the managed profiles list
            await this.context.globalState.update('managedProfiles', distributions.map(d => d.name));
            
            logger.performance('Terminal profiles updated', Date.now() - startTime, {
                profileCount: distributions.length,
                removedCount: managedProfiles.length
            });
        } catch (error) {
            logger.error('Failed to update terminal profiles', error);
            throw error;
        }
    }

    async removeTerminalProfiles(): Promise<void> {
        logger.info('Removing all managed terminal profiles');
        
        try {
            const config = vscode.workspace.getConfiguration('terminal.integrated.profiles.windows');
            const profiles = config.get<any>('', {}) || {};
            
            // Create backup for rollback
            const backup = JSON.parse(JSON.stringify(profiles));

            // Remove all managed profiles
            const managedProfiles = Object.keys(profiles).filter(key => key.startsWith(this.profilePrefix));
            managedProfiles.forEach(key => delete profiles[key]);
            
            if (managedProfiles.length === 0) {
                logger.debug('No managed profiles to remove');
                return;
            }

            try {
                await config.update('', profiles, vscode.ConfigurationTarget.Global);
            } catch (updateError) {
                // Rollback on failure
                logger.error('Failed to remove terminal profiles, attempting rollback', updateError);
                await config.update('', backup, vscode.ConfigurationTarget.Global);
                throw updateError;
            }
            
            await this.context.globalState.update('managedProfiles', []);
            
            logger.info('Successfully removed terminal profiles', { count: managedProfiles.length });
        } catch (error) {
            logger.error('Failed to remove terminal profiles', error);
            throw new WSLError(
                ErrorType.PERMISSION_DENIED,
                'Failed to remove terminal profiles',
                'Could not update VS Code settings',
                ['Check VS Code settings permissions', 'Manually remove terminal profiles']
            );
        }
    }

    async ensureDefaultProfile(distributionName: string): Promise<void> {
        logger.debug('Checking default terminal profile', { distribution: distributionName });
        
        try {
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
                    try {
                        await config.update('defaultProfile.windows', profileName, vscode.ConfigurationTarget.Global);
                        logger.info('Set default terminal profile', { profile: profileName });
                        vscode.window.showInformationMessage(`${distributionName} is now your default terminal`);
                    } catch (error) {
                        logger.error('Failed to set default terminal profile', error);
                        throw new WSLError(
                            ErrorType.PERMISSION_DENIED,
                            'Failed to set default terminal',
                            'Could not update default terminal settings',
                            ['Check VS Code settings permissions', 'Manually set default terminal in settings']
                        );
                    }
                }
            }
        } catch (error) {
            if (!(error instanceof WSLError)) {
                logger.error('Unexpected error in ensureDefaultProfile', error);
                throw error;
            }
            throw error;
        }
    }
}
