/**
 * Tree Provider for WSL Images
 * 
 * Shows working WSL instances created from distros
 */

import * as vscode from 'vscode';
import { WSLImageManager, ImageMetadata } from '../images/WSLImageManager';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Tree item for an image
 */
export class ImageTreeItem extends vscode.TreeItem {
    constructor(
        public readonly image: ImageMetadata,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(image.displayName || image.name, collapsibleState);
        
        this.tooltip = this.makeTooltip();
        this.description = this.makeDescription();
        this.contextValue = this.getContextValue();
        this.iconPath = this.getIcon();
        
        // Add command to open terminal
        if (this.image.enabled) {
            this.command = {
                command: 'wsl-manager.openTerminal',
                title: 'Open Terminal',
                arguments: [this.image.name]
            };
        }
    }
    
    private makeTooltip(): string {
        const lines = [
            this.image.displayName || this.image.name,
            `Created: ${new Date(this.image.created).toLocaleString()}`,
            `Source: ${this.image.source} (${this.image.sourceType})`,
            `WSL Version: ${this.image.wslVersion}`
        ];

        if (this.image.description) {
            lines.push(this.image.description);
        }

        // Show scope
        if (this.image.scope) {
            if (this.image.scope.type === 'workspace') {
                lines.push(`📁 Project-specific: ${this.image.scope.workspaceName || 'current workspace'}`);
            } else {
                lines.push('🌍 Global: Available in all projects');
            }
        } else {
            lines.push('🌍 Global: Available in all projects');
        }

        if (this.image.hasManifest) {
            lines.push('✓ Has manifest');
        }

        if (this.image.tags && this.image.tags.length > 0) {
            lines.push(`Tags: ${this.image.tags.join(', ')}`);
        }

        if (!this.image.enabled) {
            lines.push('⚠ Terminal profile disabled');
        }

        return lines.join('\n');
    }
    
    private makeDescription(): string {
        const parts = [];

        // Show scope indicator first
        if (this.image.scope?.type === 'workspace') {
            parts.push('📁');  // Project-specific indicator
        } else {
            parts.push('🌍');  // Global indicator
        }

        // Show source
        if (this.image.sourceType === 'distro') {
            // Fix: Show "from distro" when source is unknown
            if (this.image.source === 'unknown') {
                parts.push('from distro');
            } else {
                parts.push(`from ${this.image.source}`);
            }
        } else {
            parts.push(`cloned from ${this.image.source}`);
        }

        // Show state if available
        if (this.image.state) {
            parts.push(this.image.state.toLowerCase());
        }
        
        // Show if disabled
        if (!this.image.enabled) {
            parts.push('disabled');
        }
        
        return parts.join(' • ');
    }
    
    private getContextValue(): string {
        const parts = ['image'];
        
        if (this.image.hasManifest) {
            parts.push('has-manifest');
        }
        
        if (this.image.enabled) {
            parts.push('enabled');
        } else {
            parts.push('disabled');
        }
        
        if (this.image.sourceType === 'image') {
            parts.push('cloned');
        }
        
        return parts.join('-');
    }
    
    private getIcon(): vscode.ThemeIcon {
        if (!this.image.enabled) {
            return new vscode.ThemeIcon('eye-closed');
        }
        
        if (this.image.state === 'Running') {
            return new vscode.ThemeIcon('vm-running');
        }
        
        if (this.image.hasManifest) {
            return new vscode.ThemeIcon('vm');
        }
        
        return new vscode.ThemeIcon('vm-outline');
    }
}

/**
 * Tree provider for images
 */
export class ImageTreeProvider implements vscode.TreeDataProvider<ImageTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ImageTreeItem | undefined | null | void> =
        new vscode.EventEmitter<ImageTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ImageTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private imageManager: WSLImageManager;
    private liveDataLoaded: boolean = false;

    constructor(imageManager?: WSLImageManager) {
        this.imageManager = imageManager || new WSLImageManager();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Mark that live data has been loaded from async operations
     */
    markLiveDataLoaded(): void {
        this.liveDataLoaded = true;
    }

    getTreeItem(element: ImageTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ImageTreeItem): Promise<ImageTreeItem[]> {
        if (element) {
            // No children for image items
            return [];
        }

        try {
            // Use cached data for instant display if live data hasn't loaded yet
            const images = this.liveDataLoaded
                ? await this.imageManager.listImages()
                : this.imageManager.getCachedImages();

            // Sort by creation date (newest first)
            images.sort((a, b) => {
                const dateA = new Date(a.created).getTime();
                const dateB = new Date(b.created).getTime();
                return dateB - dateA;
            });

            return images.map(image =>
                new ImageTreeItem(image, vscode.TreeItemCollapsibleState.None)
            );
        } catch (error) {
            logger.error('Failed to get images:', error);
            vscode.window.showErrorMessage('Failed to load image list');
            return [];
        }
    }
    
    /**
     * Get parent of an element (for reveal functionality)
     */
    getParent(element: ImageTreeItem): vscode.ProviderResult<ImageTreeItem> {
        // Images have no parent
        return undefined;
    }
}