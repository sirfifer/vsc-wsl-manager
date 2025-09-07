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
import { ImageInfo, WSLImageManager } from '../imageManager';
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
 * Provides terminal profiles for WSL images using VS Code's official API
 */
export class WSLImageTerminalProfileProvider implements vscode.TerminalProfileProvider {
    private readonly profileId: string;
    private readonly imageManager: WSLImageManager;
    
    constructor(private readonly image: ImageInfo) {
        // Create a unique profile ID for this image
        this.profileId = `wsl-manager.image.${image.name}`;
        this.imageManager = new WSLImageManager();
    }
    
    /**
     * Registers this provider with VS Code
     * @returns Disposable to unregister the provider
     */
    register(): vscode.Disposable {
        logger.debug(`Registering terminal profile provider for image ${this.image.name}`);
        
        return vscode.window.registerTerminalProfileProvider(
            this.profileId,
            this
        );
    }
    
    /**
     * Provides the terminal profile when requested by VS Code
     * This creates a temporary distribution from the image
     */
    async provideTerminalProfile(
        token: vscode.CancellationToken
    ): Promise<vscode.TerminalProfile | undefined> {
        // Respect cancellation
        if (token.isCancellationRequested) {
            logger.debug(`Profile creation cancelled for image ${this.image.name}`);
            return undefined;
        }
        
        try {
            // Create a temporary distribution name
            const tempDistroName = `wsl-img-${this.image.name}-${Date.now()}`;
            
            // Create distribution from image
            await this.imageManager.createDistributionFromImage(
                this.image.name,
                tempDistroName
            );
            
            // Create the terminal profile
            const profile = new vscode.TerminalProfile({
                name: `WSL: ${this.image.name}`,
                shellPath: 'wsl.exe',
                shellArgs: ['-d', tempDistroName]
            });
            
            logger.info(`Terminal profile created for image ${this.image.name}`);
            return profile;
            
        } catch (error) {
            logger.error(`Failed to create terminal profile for image ${this.image.name}`, error);
            vscode.window.showErrorMessage(
                `Failed to create terminal from image ${this.image.name}: ${error}`
            );
            return undefined;
        }
    }
}

/**
 * Manages terminal profile providers for all WSL distributions and images
 * This replaces the broken TerminalProfileManager that was trying to modify settings
 */
export class WSLTerminalProfileManager {
    private disposables: vscode.Disposable[] = [];
    
    /**
     * Registers terminal profile providers for distributions and enabled images
     * @param distributions List of WSL distributions
     * @param images List of WSL images (only enabled ones will be registered)
     * @returns Array of disposables for cleanup
     */
    registerProfiles(distributions: WSLDistribution[], images: ImageInfo[] = []): vscode.Disposable[] {
        logger.info(`Registering terminal profiles for ${distributions.length} distributions and ${images.length} images`);
        
        // Dispose old profiles
        this.dispose();
        
        // Register distribution profiles
        for (const distro of distributions) {
            const provider = new WSLTerminalProfileProvider(distro);
            this.disposables.push(provider.register());
        }
        
        // Register image profiles (only enabled images)
        const enabledImages = images.filter(img => img.enabled !== false);
        logger.info(`Registering ${enabledImages.length} enabled image profiles`);
        
        for (const image of enabledImages) {
            const provider = new WSLImageTerminalProfileProvider(image);
            this.disposables.push(provider.register());
        }
        
        logger.debug(`Successfully registered ${this.disposables.length} terminal profiles`);
        
        return this.disposables;
    }
    
    /**
     * Updates the registered profiles when distributions or images change
     * @param distributions Updated list of distributions
     * @param images Updated list of images
     */
    updateProfiles(distributions: WSLDistribution[], images: ImageInfo[] = []): void {
        logger.info('Updating terminal profiles');
        this.registerProfiles(distributions, images);
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