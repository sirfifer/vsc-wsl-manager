import * as vscode from 'vscode';
import { WSLImageManager, ImageInfo } from './imageManager';

/**
 * Tree data provider for displaying WSL images in VS Code's tree view
 * Manages the WSL Images view with enabled/disabled state support
 */
export class WSLImageTreeDataProvider implements vscode.TreeDataProvider<ImageTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ImageTreeItem | undefined | null | void> = new vscode.EventEmitter<ImageTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ImageTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private imageManager: WSLImageManager) {}

    /**
     * Refreshes the tree view by firing the change event
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Gets the tree item representation for display
     */
    getTreeItem(element: ImageTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets child elements for a tree item
     * Returns empty array to trigger welcome view when no images exist
     */
    async getChildren(element?: ImageTreeItem): Promise<ImageTreeItem[]> {
        if (!element) {
            try {
                const images = await this.imageManager.listImages();
                
                // Return empty array to trigger welcome view
                if (images.length === 0) {
                    return [];
                }
                
                // Return flat list of images
                return images.map(image => new ImageTreeItem(image));
            } catch (error) {
                console.warn('Failed to load images:', error);
                return [];
            }
        }
        return [];
    }

    /**
     * Gets only enabled images for terminal profile registration
     */
    async getEnabledImages(): Promise<ImageInfo[]> {
        try {
            const images = await this.imageManager.listImages();
            return images.filter(img => img.enabled !== false); // Default to enabled if not specified
        } catch (error) {
            console.warn('Failed to load enabled images:', error);
            return [];
        }
    }
}

/**
 * Tree item representing a WSL image with enabled/disabled state
 */
export class ImageTreeItem extends vscode.TreeItem {
    constructor(public readonly image: ImageInfo) {
        super(image.name, vscode.TreeItemCollapsibleState.None);
        
        // Set context value based on enabled state
        const isEnabled = image.enabled !== false; // Default to enabled if not specified
        this.contextValue = isEnabled ? 'image-enabled' : 'image-disabled';
        
        // Visual distinction for disabled images
        this.iconPath = new vscode.ThemeIcon(
            'package',
            isEnabled ? undefined : new vscode.ThemeColor('disabledForeground')
        );
        
        // Show base and enabled/disabled status
        const base = image.baseDistribution || image.baseImage || 'Unknown';
        this.description = isEnabled 
            ? base
            : `${base} (disabled)`;
        
        // Detailed tooltip
        this.tooltip = new vscode.MarkdownString(
            `**${image.name}**\n\n` +
            `Base: ${base}\n` +
            (image.description ? `Description: ${image.description}\n` : '') +
            `Status: ${isEnabled ? 'Enabled' : 'Disabled'}`,
            true
        );
    }
}