import * as vscode from 'vscode';
import { WSLManager, WSLDistribution } from './wslManager';
import * as path from 'path';

/**
 * Tree data provider for displaying WSL distributions in VS Code's tree view
 * 
 * @example
 * ```typescript
 * const provider = new WSLTreeDataProvider(wslManager);
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
     */
    constructor(private wslManager: WSLManager) {}

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
     * - When element is undefined, returns list of distributions
     * - When element is a distribution, returns distribution details
     */
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

/**
 * Tree item representing a WSL distribution or distribution information
 */
class WSLTreeItem extends vscode.TreeItem {
    /**
     * Creates a new WSL tree item
     * 
     * @param label - Display label for the tree item
     * @param distribution - Associated WSL distribution
     * @param collapsibleState - Whether the item can be expanded
     * @param type - Type of tree item (distribution or info)
     */
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
