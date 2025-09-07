import * as vscode from 'vscode';
import { WSLManager, WSLDistribution } from './wslManager';

/**
 * Tree data provider for displaying WSL distributions in VS Code's tree view
 * Manages the WSL Distributions view (distributions are templates, no running status)
 */
export class WSLDistributionTreeDataProvider implements vscode.TreeDataProvider<DistributionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DistributionTreeItem | undefined | null | void> = new vscode.EventEmitter<DistributionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DistributionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private wslManager: WSLManager) {}

    /**
     * Refreshes the tree view by firing the change event
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Gets the tree item representation for display
     */
    getTreeItem(element: DistributionTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets child elements for a tree item
     * Returns empty array to trigger welcome view when no distributions exist
     */
    async getChildren(element?: DistributionTreeItem): Promise<DistributionTreeItem[]> {
        if (!element) {
            try {
                const distributions = await this.wslManager.listDistributions();
                
                // Return empty array to trigger welcome view
                if (distributions.length === 0) {
                    return [];
                }
                
                // Return flat list of distributions
                return distributions.map(distro => new DistributionTreeItem(distro));
            } catch (error) {
                console.warn('Failed to load distributions:', error);
                return [];
            }
        }
        return [];
    }
}

/**
 * Tree item representing a WSL distribution (template file, no running status)
 */
export class DistributionTreeItem extends vscode.TreeItem {
    constructor(public readonly distribution: WSLDistribution) {
        super(distribution.name, vscode.TreeItemCollapsibleState.None);
        
        this.contextValue = 'distribution';
        this.iconPath = new vscode.ThemeIcon('server-environment');
        
        // Only show default flag, no running/stopped status
        // Distributions are templates, not running instances
        this.description = distribution.default ? '(default)' : '';
        
        // Detailed tooltip without status
        this.tooltip = new vscode.MarkdownString(
            `**${distribution.name}**\n\n` +
            `Version: WSL${distribution.version}\n` +
            (distribution.default ? 'Default distribution\n' : ''),
            true
        );
    }
}