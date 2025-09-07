/**
 * WSL Terminal Profile Provider
 * Implements VS Code's official Terminal Profile Provider API
 * 
 * This is the CORRECT way to provide terminal profiles in VS Code extensions.
 * We do NOT modify terminal.integrated.profiles.* settings directly.
 * 
 * @see https://code.visualstudio.com/api/references/vscode-api#window.registerTerminalProfileProvider
 */

import * as vscode from 'vscode';
import { WSLDistribution } from '../wslManager';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Provides terminal profiles for WSL distributions using VS Code's official API
 */
export class WSLTerminalProfileProvider implements vscode.TerminalProfileProvider {
    private readonly profileId: string;
    
    constructor(private readonly distribution: WSLDistribution) {
        // Create a unique profile ID for this distribution
        this.profileId = `wsl-manager.${distribution.name}`;
    }
    
    /**
     * Registers this provider with VS Code
     * @returns Disposable to unregister the provider
     */
    register(): vscode.Disposable {
        logger.debug(`Registering terminal profile provider for ${this.distribution.name}`);
        
        return vscode.window.registerTerminalProfileProvider(
            this.profileId,
            this
        );
    }
    
    /**
     * Provides the terminal profile when requested by VS Code
     * This is called when the user selects this profile from the terminal dropdown
     */
    async provideTerminalProfile(
        token: vscode.CancellationToken
    ): Promise<vscode.TerminalProfile | undefined> {
        // Respect cancellation
        if (token.isCancellationRequested) {
            logger.debug(`Profile creation cancelled for ${this.distribution.name}`);
            return undefined;
        }
        
        // Build the terminal name
        let name = `WSL: ${this.distribution.name}`;
        if (this.distribution.default) {
            name += ' (default)';
        } else if (this.distribution.state === 'Stopped') {
            name += ' (stopped)';
        }
        
        logger.info(`Creating terminal profile for ${this.distribution.name}`);
        
        // Return the terminal profile
        return {
            options: {
                name,
                shellPath: 'wsl.exe',
                shellArgs: ['-d', this.distribution.name],
                iconPath: new vscode.ThemeIcon('terminal-linux'),
                env: {}
            }
        };
    }
}

/**
 * Manages terminal profile providers for all WSL distributions
 * This replaces the broken TerminalProfileManager that was trying to modify settings
 */
export class WSLTerminalProfileManager {
    private disposables: vscode.Disposable[] = [];
    
    /**
     * Registers terminal profile providers for all distributions
     * @param distributions List of WSL distributions
     * @returns Array of disposables for cleanup
     */
    registerProfiles(distributions: WSLDistribution[]): vscode.Disposable[] {
        logger.info(`Registering terminal profiles for ${distributions.length} distributions`);
        
        // Dispose old profiles
        this.dispose();
        
        // Register new profiles
        this.disposables = distributions.map(distro => {
            const provider = new WSLTerminalProfileProvider(distro);
            return provider.register();
        });
        
        logger.debug(`Successfully registered ${this.disposables.length} terminal profiles`);
        
        return this.disposables;
    }
    
    /**
     * Updates the registered profiles when distributions change
     * @param distributions Updated list of distributions
     */
    updateProfiles(distributions: WSLDistribution[]): void {
        logger.info('Updating terminal profiles');
        this.registerProfiles(distributions);
    }
    
    /**
     * Disposes all registered profile providers
     * Should be called on extension deactivation
     */
    dispose(): void {
        logger.debug(`Disposing ${this.disposables.length} terminal profile providers`);
        
        this.disposables.forEach(d => {
            try {
                d.dispose();
            } catch (error) {
                logger.error('Error disposing terminal profile provider', error);
            }
        });
        
        this.disposables = [];
    }
}

/**
 * Creates and manages terminal profile providers for WSL distributions
 * 
 * Usage in extension.ts:
 * ```typescript
 * const terminalProfileManager = new WSLTerminalProfileManager();
 * 
 * // On activation or when distributions change
 * const distributions = await wslManager.listDistributions();
 * terminalProfileManager.registerProfiles(distributions);
 * 
 * // On deactivation
 * terminalProfileManager.dispose();
 * ```
 */