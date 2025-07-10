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
