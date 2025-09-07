import * as vscode from 'vscode';
import { WSLManager, WSLDistribution } from './wslManager';
import { WSLImageManager, ImageInfo } from './imageManager';
import * as path from 'path';

/**
 * Tree data provider for displaying WSL distributions and images in VS Code's tree view
 * Provides a two-section layout: Distributions and Images
 * 
 * @example
 * ```typescript
 * const provider = new WSLTreeDataProvider(wslManager, imageManager);
 * vscode.window.createTreeView('wslDistributions', { treeDataProvider: provider });
 * ```
 */
export class WSLTreeDataProvider implements vscode.TreeDataProvider<WSLTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WSLTreeItem | undefined | null | void> = new vscode.EventEmitter<WSLTreeItem | undefined | null | void>();
    /** Event fired when tree data changes */
    readonly onDidChangeTreeData: vscode.Event<WSLTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    /**
     * Creates a new WSL tree data provider
     * @param wslManager - WSL manager instance for retrieving distribution data
     * @param imageManager - Image manager instance for retrieving image data
     */
    constructor(private wslManager: WSLManager, private imageManager: WSLImageManager) {}

    /**
     * Refreshes the tree view by firing the change event
     * 
     * @example
     * ```typescript
     * provider.refresh(); // Updates the tree view
     * ```
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Gets the tree item representation for display
     * 
     * @param element - The tree item to display
     * @returns The tree item for VS Code to render
     */
    getTreeItem(element: WSLTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets child elements for a tree item
     * 
     * @param element - Parent element, or undefined for root level
     * @returns Promise resolving to array of child tree items
     * 
     * @remarks
     * - When element is undefined, returns main sections (Distributions and Images)
     * - When element is a section, returns section contents with action buttons
     * - When element is a distribution, returns distribution details
     */
    async getChildren(element?: WSLTreeItem): Promise<WSLTreeItem[]> {
        if (!element) {
            // Root level - show main sections
            return [
                new WSLTreeItem(
                    'Distributions',
                    null,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'section'
                ),
                new WSLTreeItem(
                    'Images',
                    null,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'section'
                )
            ];
        } else if (element.type === 'section') {
            if (element.label === 'Distributions') {
                return await this.getDistributionsSection();
            } else if (element.label === 'Images') {
                return await this.getImagesSection();
            }
        } else if (element.type === 'distribution') {
            // Distribution details
            const info = await this.wslManager.getDistributionInfo(element.distribution!.name);
            const items: WSLTreeItem[] = [];

            items.push(new WSLTreeItem(
                `State: ${element.distribution!.state}`,
                element.distribution!,
                vscode.TreeItemCollapsibleState.None,
                'info'
            ));

            items.push(new WSLTreeItem(
                `Version: WSL${element.distribution!.version}`,
                element.distribution!,
                vscode.TreeItemCollapsibleState.None,
                'info'
            ));

            if (element.distribution!.default) {
                items.push(new WSLTreeItem(
                    'Default Distribution',
                    element.distribution!,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            if (info.os) {
                items.push(new WSLTreeItem(
                    `OS: ${info.os.trim()}`,
                    element.distribution!,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            if (info.kernel) {
                items.push(new WSLTreeItem(
                    `Kernel: ${info.kernel.trim()}`,
                    element.distribution!,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            if (info.totalMemory) {
                items.push(new WSLTreeItem(
                    `Memory: ${info.totalMemory}`,
                    element.distribution!,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                ));
            }

            return items;
        }

        return [];
    }

    /**
     * Gets the contents of the Distributions section
     */
    private async getDistributionsSection(): Promise<WSLTreeItem[]> {
        const items: WSLTreeItem[] = [];

        // Add Download Distribution action button at the top
        items.push(new WSLTreeItem(
            'Download Distribution',
            null,
            vscode.TreeItemCollapsibleState.None,
            'action',
            'wsl-manager.downloadDistribution'
        ));

        // Add existing distributions
        const distributions = await this.wslManager.listDistributions();
        distributions.forEach(distro => {
            items.push(new WSLTreeItem(
                distro.name,
                distro,
                vscode.TreeItemCollapsibleState.Collapsed,
                'distribution'
            ));
        });

        return items;
    }

    /**
     * Gets the contents of the Images section
     */
    private async getImagesSection(): Promise<WSLTreeItem[]> {
        const items: WSLTreeItem[] = [];

        // Add Create Image action button at the top
        items.push(new WSLTreeItem(
            'Create new Image from Distribution',
            null,
            vscode.TreeItemCollapsibleState.None,
            'action',
            'wsl-manager.selectDistributionForImage'
        ));

        // Add existing images
        try {
            const images = await this.imageManager.listImages();
            images.forEach(image => {
                items.push(new WSLTreeItem(
                    image.name,
                    null,
                    vscode.TreeItemCollapsibleState.None,
                    'image',
                    undefined,
                    image
                ));
            });
        } catch (error) {
            console.warn('Failed to load images:', error);
        }

        return items;
    }
}

/**
 * Tree item representing various elements in the WSL tree view
 */
class WSLTreeItem extends vscode.TreeItem {
    /**
     * Creates a new WSL tree item
     * 
     * @param label - Display label for the tree item
     * @param distribution - Associated WSL distribution (optional)
     * @param collapsibleState - Whether the item can be expanded
     * @param type - Type of tree item
     * @param command - Command to execute when clicked (for action items)
     * @param image - Associated image info (for image items)
     */
    constructor(
        public readonly label: string,
        public readonly distribution: WSLDistribution | null,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'section' | 'distribution' | 'info' | 'action' | 'image' = 'distribution',
        command?: string,
        public readonly image?: ImageInfo
    ) {
        super(label, collapsibleState);

        this.tooltip = this.label;
        this.contextValue = type;

        // Set command for action items
        if (command) {
            this.command = {
                command,
                title: label,
                arguments: [this]
            };
        }

        // Set icons and descriptions based on type
        this.setupAppearance();
    }

    private setupAppearance(): void {
        switch (this.type) {
            case 'section':
                if (this.label === 'Distributions') {
                    this.iconPath = new vscode.ThemeIcon('server');
                } else if (this.label === 'Images') {
                    this.iconPath = new vscode.ThemeIcon('package');
                }
                break;

            case 'distribution':
                if (this.distribution) {
                    this.iconPath = this.getDistributionIcon(this.distribution);
                    this.description = this.distribution.state;
                    
                    if (this.distribution.default) {
                        this.description += ' (default)';
                    }
                }
                break;

            case 'info':
                this.iconPath = new vscode.ThemeIcon('info');
                break;

            case 'action':
                if (this.label === 'Download Distribution') {
                    this.iconPath = new vscode.ThemeIcon('cloud-download');
                    this.tooltip = 'Download and install a new WSL distribution';
                } else if (this.label === 'Create new Image from Distribution') {
                    this.iconPath = new vscode.ThemeIcon('add');
                    this.tooltip = 'Create a reusable image from an existing distribution';
                }
                break;

            case 'image':
                this.iconPath = new vscode.ThemeIcon('file-zip');
                if (this.image) {
                    this.description = `based on ${this.image.baseDistribution}`;
                    this.tooltip = this.image.description || `Image created from ${this.image.baseDistribution}`;
                }
                break;
        }
    }

    private getDistributionIcon(distribution: WSLDistribution): vscode.ThemeIcon {
        if (distribution.state === 'Running') {
            return new vscode.ThemeIcon('vm-active', new vscode.ThemeColor('charts.green'));
        } else {
            return new vscode.ThemeIcon('vm', new vscode.ThemeColor('charts.gray'));
        }
    }
}
